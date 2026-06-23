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
import { PolicyExpressionService } from './policy-expression-service';
import { PolicyFilters, PolicyStatementWithExpression, PolicyWithStatements } from './policy-service.interface';
import { PolicyStatementExpressionService } from './policy-statement-expression-service';
import { PolicyStatementService } from './policy-statement-service';
import { SecurityScopeService } from './security-scope-service';

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyStatementExpressionService: PolicyStatementExpressionService;
  policyExpressionService: PolicyExpressionService;
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
    this.policyStatementExpressionService = new PolicyStatementExpressionService(connection);
    this.policyExpressionService = new PolicyExpressionService(connection);
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

    this.assertValidStatusTransition(currentPolicy.status, policyData.status);

    const updated = await this.policyRepository.updatePolicy(policyId, policyData);

    // Cache orchestration runs only after the row write succeeds — a rejected
    // status write must not mutate the cache.
    await this.applyCacheFanOutForTransition(policyId, currentPolicy.status, policyData.status);

    return updated;
  }

  /**
   * Apply the access-cache side effects implied by a policy status transition.
   *
   * The cache materializes lazily and reflects standing access only: a row
   * exists iff a live `team_policy` links a team to an approved policy with at
   * least one ALLOW statement. Two transitions move rows in or out:
   *
   *   - `* → approved` materializes scope + mapping + team-grant rows for each
   *     linked team.
   *   - `approved → *` rebuilds each linked team from the remaining policy
   *     chain. Without the reverse direction, a downgraded policy would
   *     silently keep granting access.
   *
   * Same-status calls and transitions that do not involve `approved` (e.g.
   * `requested → reviewed`) are no-ops; the call shape `(policyId, from, to)`
   * stays the same so callers do not need to branch on whether status changed.
   *
   * Teams are processed sequentially to pin grant ordering and keep the
   * connection-use window bounded.
   *
   * @private
   * @param {string} policyId - Policy UUID.
   * @param {PolicyStatus} from - Status the policy held before the write.
   * @param {PolicyStatus} to - Status the policy holds after the write.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  private async applyCacheFanOutForTransition(policyId: string, from: PolicyStatus, to: PolicyStatus): Promise<void> {
    if (from === to) {
      return;
    }

    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    if (teamPolicies.length === 0) {
      return;
    }

    if (to === 'approved') {
      // Materialize the shared statement-scope rows once for this policy, then
      // grant access per team. The statement-scope work depends only on the
      // policy, so splitting these avoids re-running the policy-wide INSERTs
      // and re-publishing anchor jobs for every team in the fan-out.
      const materialized = await this.securityScopeService.materializePolicyStatementScopes(policyId);
      if (!materialized) {
        return;
      }
      for (const teamPolicy of teamPolicies) {
        await this.securityScopeService.grantTeamAccessForPolicy(teamPolicy.team_id, policyId);
      }
    } else if (from === 'approved') {
      for (const teamPolicy of teamPolicies) {
        await this.securityScopeService.rebuildTeamSecurityScopes(teamPolicy.team_id);
      }
    }
  }

  /**
   * Validate lifecycle transition between two policy status values.
   *
   * Encodes the full transition matrix plus the additional "requested cannot
   * jump directly to approved" guard so callers compose a single validation
   * call. Throws `HTTP400` on invalid transitions; same-status calls should be
   * filtered by the caller before reaching this method.
   *
   * @private
   * @param {PolicyStatus} current - Current policy status.
   * @param {PolicyStatus} next - Target policy status.
   * @return {void}
   * @memberof PolicyService
   */
  private assertValidStatusTransition(current: PolicyStatus, next: PolicyStatus): void {
    if (next === 'approved') {
      this.assertCanApproveRequest(current);
    }

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
   * Get policies with their statements.
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
        statements: await this.getStatementsWithExpressions(policy.policy_id)
      }))
    );

    return policiesWithStatements;
  }

  /**
   * Get a policy by identifier and include its statements.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<PolicyWithStatements>} Policy enriched with statements.
   * @memberof PolicyService
   */
  async getPolicyWithStatements(policyId: string): Promise<PolicyWithStatements> {
    const policy = await this.policyRepository.getPolicy(policyId);
    const statements = await this.getStatementsWithExpressions(policyId);
    return { ...policy, statements };
  }

  /**
   * Get policy statements and hydrate each with its expression.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<PolicyStatementWithExpression[]>} Statements with expressions.
   * @memberof PolicyService
   */
  async getStatementsWithExpressions(policyId: string): Promise<PolicyStatementWithExpression[]> {
    const statements = await this.policyStatementService.getPolicyStatements(policyId);

    return Promise.all(
      statements.map(async (stmt) => {
        const expressionLinks =
          await this.policyStatementExpressionService.getPolicyStatementExpressionsByPolicyStatementId(
            stmt.policy_statement_id
          );
        const expression = expressionLinks[0]
          ? await this.expressionTreeService.readExpressionTree(expressionLinks[0].expression_id)
          : undefined;

        return {
          ...stmt,
          ...(expression ? { expression } : {})
        };
      })
    );
  }

  /**
   * Create a policy and its associated statements.
   *
   * Statement creation no longer materializes security scopes. The access-cache
   * (`security_scope`, `policy_statement_scope`, `team_security_scope`) is only
   * populated when a `team_policy` link exists and the policy is approved — that
   * fan-out lives in `SecurityScopeService.materializePolicyStatementScopes` +
   * `grantTeamAccessForPolicy` and fires from `TeamPolicyService.createTeamPolicy`
   * and from policy approval.
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
   * Update a policy and fully replace its statements.
   *
   * Order is deliberate: status-transition validation runs first so a rejected
   * transition cannot leave the statement set replaced and the policy row
   * unchanged. Statements are replaced next, then stale scope mappings are
   * cleaned up, then the policy row is written. The shared transition helper
   * runs last so the single cache orchestration sees the new statement set.
   *
   * For approved policies whose status did not change, the helper is a no-op
   * — but the statement set still changed, so the cache is re-derived here
   * with a per-team materialize against the new mappings.
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
    // Capture state up front so we can decide validation + final orchestration.
    const previousPolicy = await this.policyRepository.getPolicy(policyId);
    const previousStatus = previousPolicy.status;
    const nextStatus = policyData.status ?? previousStatus;

    // Validate the status transition before any mutation so a rejected
    // transition cannot leave the statement set replaced and the row unchanged.
    if (policyData.status !== undefined && policyData.status !== previousStatus) {
      this.assertValidStatusTransition(previousStatus, policyData.status);
    }

    // Capture existing statement associations + linked teams before replacement.
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

    // Write the policy row directly — validation already ran above so we do
    // not need to re-enter the public `updatePolicy` path (which would also
    // orchestrate, doubling the fan-out). The shared transition helper below
    // owns the cache side effect.
    const policy = await this.policyRepository.updatePolicy(policyId, policyData);

    await this.applyCacheFanOutForTransition(policyId, previousStatus, nextStatus);

    // Statement-set replacement on an approved policy with linked teams must
    // re-derive the cache even when status did not change — the transition
    // helper is a no-op on same-status calls, and the new mappings do not
    // exist in `team_security_scope` until we materialize.
    if (previousStatus === nextStatus && nextStatus === 'approved' && affectedTeamIds.length > 0) {
      // Materialize the policy-wide scope mappings once, then grant per team.
      const materialized = await this.securityScopeService.materializePolicyStatementScopes(policyId);
      if (materialized) {
        for (const teamId of affectedTeamIds) {
          await this.securityScopeService.grantTeamAccessForPolicy(teamId, policyId);
        }
      }
    }

    return { ...policy, statements: createdStatements };
  }

  /**
   * Create policy statements and their expressions.
   *
   * @private
   * @param {string} policyId - Policy UUID.
   * @param {CreatePolicyStatementPayload[]} statements - Statement payloads.
   * @return {Promise<PolicyStatementWithExpression[]>} Created statements with expressions.
   * @memberof PolicyService
   */
  private async createStatements(
    policyId: string,
    statements: CreatePolicyStatementPayload[]
  ): Promise<PolicyStatementWithExpression[]> {
    return Promise.all(
      statements.map(async (stmt) => {
        const statement = await this.policyStatementService.createPolicyStatement({
          policy_id: policyId,
          effect: stmt.effect,
          submission_feature_urn: stmt.submission_feature_urn
        });

        if (stmt.expression) {
          const { expression_id } = await this.expressionTreeService.writeExpressionTree(stmt.expression);
          const policyExpression = await this.policyExpressionService.ensurePolicyExpression(policyId, expression_id);
          await this.policyStatementExpressionService.replacePolicyStatementExpression(
            statement.policy_statement_id,
            policyExpression.policy_expression_id
          );
        }

        return { ...statement, ...(stmt.expression ? { expression: stmt.expression } : {}) };
      })
    );
  }
}
