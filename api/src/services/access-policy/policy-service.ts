import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { HTTP400 } from '../../errors/http-error';
import { CreatePolicy, Policy, PolicyStatus, UpdatePolicy } from '../../models/policy';
import { CreatePolicyStatementPayload } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { PolicyFilters, PolicyStatementWithConditions, PolicyWithStatements } from './policy-service.interface';
import { PolicyStatementConditionService } from './policy-statement-condition-service';
import { PolicyStatementExpressionService } from './policy-statement-expression-service';
import { PolicyStatementService } from './policy-statement-service';
import { SecurityScopeService } from './security-scope-service';

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyStatementConditionService: PolicyStatementConditionService;
  policyStatementExpressionService: PolicyStatementExpressionService;
  expressionTreeService: ExpressionTreeService;
  securityScopeService: SecurityScopeService;
  teamPolicyRepository: TeamPolicyRepository;

  /**
   * Creates an instance of PolicyService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof PolicyService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyRepository = new PolicyRepository(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.policyStatementConditionService = new PolicyStatementConditionService(connection);
    this.policyStatementExpressionService = new PolicyStatementExpressionService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.securityScopeService = new SecurityScopeService(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Get a policy by identifier.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<Policy>} Matching policy.
   * @memberof PolicyService
   */
  getPolicy(policyId: string): Promise<Policy> {
    return this.policyRepository.getPolicy(policyId);
  }

  /**
   * List policies with optional filters and pagination.
   *
   * @param {PolicyFilters} [filters] - Optional policy filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Policy[]>} Matching policies.
   * @memberof PolicyService
   */
  getPolicies(filters?: PolicyFilters, pagination?: ApiPaginationOptions): Promise<Policy[]> {
    return this.policyRepository.getPolicies(filters, pagination);
  }

  /**
   * Count policies that match optional filters.
   *
   * @param {PolicyFilters} [filters] - Optional policy filters.
   * @return {Promise<number>} Count of matching policies.
   * @memberof PolicyService
   */
  getPoliciesCount(filters?: PolicyFilters): Promise<number> {
    return this.policyRepository.getPoliciesCount(filters);
  }

  /**
   * Find policies that authorize feature access for a URN and system user.
   *
   * @param {string} urn - Feature URN.
   * @param {number} systemUserId - System user identifier.
   * @return {Promise<Policy[]>} Matching policies.
   * @memberof PolicyService
   */
  getPoliciesThatAuthorizeFeatureAccessByUrn(urn: string, systemUserId: number): Promise<Policy[]> {
    const urnParts = parseFeatureUrn(urn);
    return this.policyRepository.getPoliciesThatAuthorizeFeatureAccessByUrn(urnParts, systemUserId);
  }

  /**
   * Update policy fields, validate lifecycle transitions, and keep the access
   * cache in sync with the resulting status.
   *
   * The access cache (`security_scope`, `policy_statement_scope`,
   * `team_security_scope`) must mirror the policy's approval state: an
   * approved policy with linked `team_policies` must have rows; a non-approved
   * policy must not. The reverse direction is load-bearing — without rebuilding
   * each linked team when a policy leaves `approved`, the cache would silently
   * keep granting access through a downgraded or denied policy.
   *
   * Validation runs before any cache writes so a rejected status change cannot
   * mutate the cache. Teams are processed sequentially to pin grant ordering
   * and keep the connection-use window bounded.
   *
   * @param {string} policyId - Policy UUID.
   * @param {UpdatePolicy} policyData - Partial policy update payload.
   * @return {Promise<Policy>} Updated policy.
   * @memberof PolicyService
   */
  async updatePolicy(policyId: string, policyData: UpdatePolicy): Promise<Policy> {
    // Updates that do not include a status value bypass workflow validation.
    if (policyData.status === undefined) {
      return this.policyRepository.updatePolicy(policyId, policyData);
    }

    const currentPolicy = await this.policyRepository.getPolicy(policyId);
    // Status updates that keep the same current status are allowed.
    if (currentPolicy.status === policyData.status) {
      return this.policyRepository.updatePolicy(policyId, policyData);
    }

    // Explicit approval requests are guarded: requests must be reviewed before approval.
    if (policyData.status === 'approved') {
      this.assertCanApproveRequest(currentPolicy.status);
    }

    // Enforce lifecycle transition matrix for all status changes.
    this.assertValidStatusTransition(currentPolicy.status, policyData.status);

    const updated = await this.policyRepository.updatePolicy(policyId, policyData);

    // Orchestrate the access cache for any linked team_policies. Validation must
    // succeed before this point so a rejected status write cannot mutate the cache.
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    if (teamPolicies.length === 0) {
      return updated;
    }

    if (policyData.status === 'approved') {
      // Transition into approved — populate the cache for each linked team.
      for (const teamPolicy of teamPolicies) {
        await this.securityScopeService.materializeStatementScopesAndTeamAccess(teamPolicy.team_id, policyId);
      }
    } else if (currentPolicy.status === 'approved') {
      // Transition out of approved — rebuild each linked team from the remaining
      // policy chain. Without the reverse direction, a downgraded policy would
      // silently keep granting access.
      for (const teamPolicy of teamPolicies) {
        await this.securityScopeService.rebuildTeamSecurityScopes(teamPolicy.team_id);
      }
    }

    return updated;
  }

  /**
   * Assert that a request can be approved based on policy readiness.
   *
   * @private
   * @param {(PolicyStatus)} current - Current policy status.
   * @return {void}
   * @memberof PolicyService
   */
  private assertCanApproveRequest(current: PolicyStatus): void {
    // Direct transitions from requested to approved are blocked by this branch workflow.
    const blockedStatuses = new Set(['requested']);

    if (blockedStatuses.has(current)) {
      throw new HTTP400(`Cannot approve request while policy is '${current}'`);
    }
  }

  /**
   * Validate lifecycle transition between two policy status values.
   *
   * @private
   * @param {PolicyStatus} current - Current policy status.
   * @param {PolicyStatus} next - Target policy status.
   * @return {void}
   * @memberof PolicyService
   */
  private assertValidStatusTransition(current: PolicyStatus, next: PolicyStatus): void {
    const validTransitions: Record<PolicyStatus, PolicyStatus[]> = {
      requested: ['reviewed', 'denied'],
      reviewed: ['approved', 'denied'],
      approved: ['reviewed', 'denied'],
      denied: ['reviewed']
    };

    if (!validTransitions[current].includes(next)) {
      throw new HTTP400(`Invalid policy status transition: ${current} -> ${next}`);
    }
  }

  /**
   * Delete a policy and run associated cleanup.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  async deletePolicy(policyId: string): Promise<void> {
    const [teamPolicies, statements] = await Promise.all([
      this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] }),
      this.policyStatementService.getPolicyStatements(policyId)
    ]);

    const affectedTeamIds = teamPolicies.map((tp) => tp.team_id);
    const statementIds = statements.map((s) => s.policy_statement_id);

    await this.policyRepository.deletePolicy(policyId);

    if (statementIds.length > 0) {
      await this.securityScopeService.cleanupScopesForDeletedStatements(statementIds, affectedTeamIds);
    }
  }

  /**
   * Get policies with their statements and conditions.
   *
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<PolicyWithStatements[]>}
   * @memberof PolicyService
   */
  async getPoliciesWithStatements(
    filters?: PolicyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<PolicyWithStatements[]> {
    const policies = await this.policyRepository.getPolicies(filters, pagination);

    const policiesWithStatements = await Promise.all(
      policies.map(async (policy) => ({
        ...policy,
        statements: await this.getStatementsWithConditions(policy.policy_id)
      }))
    );

    return policiesWithStatements;
  }

  /**
   * Get a policy by identifier and include its statements with conditions.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<PolicyWithStatements>} Policy enriched with statements and conditions.
   * @memberof PolicyService
   */
  async getPolicyWithStatements(policyId: string): Promise<PolicyWithStatements> {
    const policy = await this.policyRepository.getPolicy(policyId);
    const statements = await this.getStatementsWithConditions(policyId);
    return { ...policy, statements };
  }

  /**
   * Get policy statements and hydrate each with its conditions.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<PolicyStatementWithConditions[]>} Statements with conditions.
   * @memberof PolicyService
   */
  async getStatementsWithConditions(policyId: string): Promise<PolicyStatementWithConditions[]> {
    const statements = await this.policyStatementService.getPolicyStatements(policyId);

    return Promise.all(
      statements.map(async (stmt) => {
        const [conditions, expressionLinks] = await Promise.all([
          this.policyStatementConditionService.getPolicyStatementConditions(stmt.policy_statement_id),
          this.policyStatementExpressionService.getPolicyStatementExpressionsByPolicyStatementId(
            stmt.policy_statement_id
          )
        ]);
        const expression = expressionLinks[0]
          ? await this.expressionTreeService.readExpressionTree(expressionLinks[0].expression_id)
          : undefined;

        return {
          ...stmt,
          conditions,
          ...(expression ? { expression } : {})
        };
      })
    );
  }

  /**
   * Create a policy and its associated statements and conditions.
   *
   * Statement creation no longer materializes security scopes. The access-cache
   * (`security_scope`, `policy_statement_scope`, `team_security_scope`) is only
   * populated when a `team_policy` link exists and the policy is approved — that
   * fan-out lives in `SecurityScopeService.materializeStatementScopesAndTeamAccess`
   * and fires from `TeamPolicyService.createTeamPolicy` and from policy approval.
   *
   * @param {CreatePolicy} policyData - Policy payload.
   * @param {CreatePolicyStatementPayload[]} statements - Statement payloads.
   * @return {Promise<PolicyWithStatements>} Created policy with statements.
   * @memberof PolicyService
   */
  async createPolicyWithStatements(
    policyData: CreatePolicy,
    statements: CreatePolicyStatementPayload[]
  ): Promise<PolicyWithStatements> {
    const policy = await this.policyRepository.insertPolicy(policyData);
    const createdStatements = await this.createStatements(policy.policy_id, statements);
    return { ...policy, statements: createdStatements };
  }

  /**
   * Update a policy and fully replace its statements and conditions.
   *
   * After the statement set is replaced, re-derive the access cache for each
   * live `team_policy` so the cache reflects the new statement set. The grant
   * call short-circuits inside `SecurityScopeService` when the policy is not
   * approved, so non-approved policies skip the fan-out cleanly. Teams are
   * processed sequentially (not via `Promise.all`) to pin grant ordering and
   * to keep the connection-use window bounded.
   *
   * @param {string} policyId - Policy UUID.
   * @param {UpdatePolicy} policyData - Partial policy update payload.
   * @param {CreatePolicyStatementPayload[]} statements - Replacement statement payloads.
   * @return {Promise<PolicyWithStatements>} Updated policy with rebuilt statements.
   * @memberof PolicyService
   */
  async updatePolicyWithStatements(
    policyId: string,
    policyData: UpdatePolicy,
    statements: CreatePolicyStatementPayload[]
  ): Promise<PolicyWithStatements> {
    // Apply policy metadata and status changes first, including lifecycle validation.
    const policy = await this.updatePolicy(policyId, policyData);

    // Capture existing statement associations before replacement.
    const existingStatements = await this.policyStatementService.getPolicyStatements(policyId);
    const oldStatementIds = existingStatements.map((s) => s.policy_statement_id);

    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    const affectedTeamIds = teamPolicies.map((tp) => tp.team_id);

    await Promise.all(
      existingStatements.map((stmt) => this.policyStatementService.deletePolicyStatement(stmt.policy_statement_id))
    );

    // Rebuild statements from the incoming payload.
    const createdStatements = await this.createStatements(policyId, statements);

    // Remove outdated scope mappings for teams linked to this policy.
    if (oldStatementIds.length > 0) {
      await this.securityScopeService.cleanupScopesForDeletedStatements(oldStatementIds, affectedTeamIds);
    }

    // Re-derive the access cache for each live team_policy against the new
    // statement set. Non-approved policies short-circuit inside the service.
    if (policy.status === 'approved' && affectedTeamIds.length > 0) {
      for (const teamId of affectedTeamIds) {
        await this.securityScopeService.materializeStatementScopesAndTeamAccess(teamId, policyId);
      }
    }

    return { ...policy, statements: createdStatements };
  }

  /**
   * Create policy statements and their nested conditions and expressions.
   *
   * @private
   * @param {string} policyId - Policy UUID.
   * @param {CreatePolicyStatementPayload[]} statements - Statement payloads.
   * @return {Promise<PolicyStatementWithConditions[]>} Created statements with conditions.
   * @memberof PolicyService
   */
  private async createStatements(
    policyId: string,
    statements: CreatePolicyStatementPayload[]
  ): Promise<PolicyStatementWithConditions[]> {
    return Promise.all(
      statements.map(async (stmt) => {
        const statement = await this.policyStatementService.createPolicyStatement({
          policy_id: policyId,
          effect: stmt.effect,
          submission_feature_urn: stmt.submission_feature_urn
        });

        const conditions = await Promise.all(
          (stmt.conditions || []).map((cond) =>
            this.policyStatementConditionService.createPolicyStatementCondition({
              policy_statement_id: statement.policy_statement_id,
              operator: cond.operator,
              key: cond.key,
              value: cond.value
            })
          )
        );

        if (stmt.expression) {
          const { expression_id } = await this.expressionTreeService.writeExpressionTree(stmt.expression);
          await this.policyStatementExpressionService.replacePolicyStatementExpression(
            statement.policy_statement_id,
            expression_id
          );
        }

        return { ...statement, conditions, ...(stmt.expression ? { expression: stmt.expression } : {}) };
      })
    );
  }
}
