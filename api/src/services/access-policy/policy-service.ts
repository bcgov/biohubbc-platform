import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { ApiConflictError } from '../../errors/api-error';
import { HTTP400 } from '../../errors/http-error';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { CreatePolicyStatementPayload, PolicyStatement } from '../../models/policy-statement';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { PolicyExpressionService } from './policy-expression-service';
import {
  CacheFanOutTransition,
  PolicyExpressionWithExpression,
  PolicyFilters,
  PolicyWithStatements
} from './policy-service.interface';
import { PolicyStatementService } from './policy-statement-service';
import { SecurityScopeService } from './security-scope-service';

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyExpressionService: PolicyExpressionService;
  policyStatementService: PolicyStatementService;
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
    this.policyExpressionService = new PolicyExpressionService(connection);
    this.policyStatementService = new PolicyStatementService(connection);
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
   * Update policy fields and keep the access cache in sync with the resulting status.
   *
   * The access cache (`security_scope`,
   * `team_security_scope`) must mirror the policy's approval state: an
   * approved policy with linked `team_policies` must have rows; a non-approved
   * policy must not. The reverse direction is load-bearing — without rebuilding
   * each linked team when a policy leaves `approved`, the cache would silently
   * keep granting access through a downgraded or denied policy.
   *
   * The row write runs before cache orchestration so rejected persistence cannot
   * mutate the cache. Teams are processed sequentially to pin grant ordering
   * and keep the connection-use window bounded.
   *
   * @param {string} policyId - Policy UUID.
   * @param {UpdatePolicy} policyData - Partial policy update payload.
   * @return {Promise<Policy>} Updated policy.
   * @memberof PolicyService
   */
  async updatePolicy(policyId: string, policyData: UpdatePolicy): Promise<Policy> {
    // Updates that do not include a status value cannot affect approval-derived cache state.
    if (policyData.status === undefined) {
      return this.policyRepository.updatePolicy(policyId, policyData);
    }

    const currentPolicy = await this.policyRepository.getPolicy(policyId);
    // Status updates that keep the same current status are allowed.
    if (currentPolicy.status === policyData.status) {
      return this.policyRepository.updatePolicy(policyId, policyData);
    }

    const updated = await this.policyRepository.updatePolicy(policyId, policyData);

    // Cache orchestration runs only after the row write succeeds — a rejected
    // status write must not mutate the cache.
    await this.applyCacheFanOutForTransition({
      policyId,
      from: currentPolicy.status,
      to: policyData.status
    });

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
   * @param {CacheFanOutTransition} transition - Policy status transition context.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  private async applyCacheFanOutForTransition({ policyId, from, to }: CacheFanOutTransition): Promise<void> {
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
   * Soft-delete a policy and rebuild linked teams' scope grants.
   *
   * Deleting a policy revokes standing access through `team_security_scope`.
   * Scope anchors are intentionally preserved because they are reusable cache
   * rows and do not grant access without a team scope grant.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  async deletePolicy(policyId: string): Promise<void> {
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    const affectedTeamIds = teamPolicies.map((tp) => tp.team_id);

    await this.policyRepository.deletePolicy(policyId);

    await this.securityScopeService.rebuildTeamSecurityScopesForTeams(affectedTeamIds);
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
        statements: await this.policyStatementService.getPolicyStatements(policy.policy_id),
        expressions: await this.getPolicyExpressionsWithExpression(policy.policy_id)
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
    const statements = await this.policyStatementService.getPolicyStatements(policyId);
    const expressions = await this.getPolicyExpressionsWithExpression(policyId);
    return { ...policy, statements, expressions };
  }

  /**
   * Get policy expressions for a policy and hydrate each with its expression tree.
   *
   * @param {string} policyId - Policy UUID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<PolicyExpressionWithExpression[]>} Policy expressions with expression trees.
   * @memberof PolicyService
   */
  async getPolicyExpressionsWithExpression(
    policyId: string,
    pagination?: ApiPaginationOptions
  ): Promise<PolicyExpressionWithExpression[]> {
    const policyExpressions = await this.policyExpressionService.getPolicyExpressionsByPolicyId(policyId, pagination);

    return Promise.all(
      policyExpressions.map(async (policyExpression) => ({
        ...policyExpression,
        expression: await this.expressionTreeService.readExpressionTree(policyExpression.expression_id)
      }))
    );
  }

  /**
   * Count policy expressions for a policy.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<number>} Active policy expression count.
   * @memberof PolicyService
   */
  getPolicyExpressionsCount(policyId: string): Promise<number> {
    return this.policyExpressionService.getPolicyExpressionsCountByPolicyId(policyId);
  }

  /**
   * Create a policy expression and return it with its hydrated expression tree.
   *
   * @param {string} policyId - Policy UUID.
   * @param {Pick<PolicyExpressionWithExpression, 'name' | 'description' | 'expression'>} payload - Policy expression payload.
   * @return {Promise<PolicyExpressionWithExpression>} Created policy expression with expression tree.
   * @memberof PolicyService
   */
  async createPolicyExpression(
    policyId: string,
    payload: Pick<PolicyExpressionWithExpression, 'name' | 'description' | 'expression'>
  ): Promise<PolicyExpressionWithExpression> {
    await this.policyRepository.getPolicy(policyId);

    const { expression_id } = await this.expressionTreeService.writeExpressionTree(payload.expression);
    await this.assertPolicyExpressionDoesNotExist(policyId, expression_id);

    const policyExpression = await this.policyExpressionService.createPolicyExpression({
      policyId,
      expressionId: expression_id,
      name: payload.name ?? undefined,
      description: payload.description
    });

    return {
      ...policyExpression,
      expression: await this.expressionTreeService.readExpressionTree(policyExpression.expression_id)
    };
  }

  /**
   * Update a policy expression and return it with its hydrated expression tree.
   *
   * @param {string} policyId - Policy UUID.
   * @param {string} policyExpressionId - Policy-expression UUID.
   * @param {Pick<PolicyExpressionWithExpression, 'name' | 'description' | 'expression'>} payload - Policy expression payload.
   * @return {Promise<PolicyExpressionWithExpression>} Updated policy expression with expression tree.
   * @memberof PolicyService
   */
  async updatePolicyExpression(
    policyId: string,
    policyExpressionId: string,
    payload: Pick<PolicyExpressionWithExpression, 'name' | 'description' | 'expression'>
  ): Promise<PolicyExpressionWithExpression> {
    await this.policyRepository.getPolicy(policyId);

    const { expression_id } = await this.expressionTreeService.writeExpressionTree(payload.expression);
    await this.assertPolicyExpressionDoesNotExist(policyId, expression_id, policyExpressionId);

    const policyExpression = await this.policyExpressionService.updatePolicyExpressionForPolicy(
      policyId,
      policyExpressionId,
      {
        expression_id,
        name: payload.name ?? null,
        description: payload.description
      }
    );

    return {
      ...policyExpression,
      expression: await this.expressionTreeService.readExpressionTree(policyExpression.expression_id)
    };
  }

  /**
   * Soft delete a policy expression.
   *
   * @param {string} policyId - Policy UUID.
   * @param {string} policyExpressionId - Policy-expression UUID.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  async deletePolicyExpression(policyId: string, policyExpressionId: string): Promise<void> {
    await this.policyRepository.getPolicy(policyId);
    const policyExpression = await this.policyExpressionService.getPolicyExpressionById(policyExpressionId);

    if (policyExpression.policy_id !== policyId) {
      throw new HTTP400('Policy expression does not belong to policy');
    }

    const hasActiveStatementReferences = await this.policyExpressionService.hasActivePolicyStatementReferences(
      policyId,
      policyExpressionId
    );

    if (hasActiveStatementReferences) {
      throw new ApiConflictError('Cannot delete policy expression while active policy statements reference it', [
        'PolicyService->deletePolicyExpression',
        { policyId, policyExpressionId }
      ]);
    }

    await this.policyExpressionService.deletePolicyExpression(policyId, policyExpressionId);
  }

  /**
   * Assert that a policy does not already have another active policy expression
   * for the same reusable expression anchor.
   *
   * The database unique index remains the final concurrency guard, but this
   * check lets API callers receive a domain conflict instead of a raw
   * `policy_expression_nuk1` violation.
   *
   * @private
   * @param {string} policyId - Policy UUID.
   * @param {string} expressionId - Reusable expression anchor UUID.
   * @param {string} [currentPolicyExpressionId] - Existing policy-expression UUID to ignore during update.
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  private async assertPolicyExpressionDoesNotExist(
    policyId: string,
    expressionId: string,
    currentPolicyExpressionId?: string
  ): Promise<void> {
    const existingPolicyExpression = await this.policyExpressionService.getPolicyExpressionByPolicyAndExpressionId(
      policyId,
      expressionId
    );

    if (!existingPolicyExpression || existingPolicyExpression.policy_expression_id === currentPolicyExpressionId) {
      return;
    }

    throw new ApiConflictError('Policy expression already exists for policy', [
      'PolicyService->assertPolicyExpressionDoesNotExist',
      { policyId, expressionId, policyExpressionId: existingPolicyExpression.policy_expression_id }
    ]);
  }

  /**
   * Create a policy and its associated statements.
   *
   * Each statement resolves or reuses its canonical `security_scope` row, writes
   * any existing policy-expression link, and asks the security-scope service to
   * refresh derived access for the policy. For a new policy with no team links
   * this is a no-op; for an already-linked approved policy it keeps team grants
   * current.
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
    const expressions = await this.getPolicyExpressionsWithExpression(policy.policy_id);
    return { ...policy, statements: createdStatements, expressions };
  }

  /**
   * Create policy statements for a policy.
   *
   * Delegates each row to `PolicyStatementService.createPolicyStatement`, which
   * resolves reusable security scopes, validates policy-expression links, and
   * refreshes derived policy access as needed.
   *
   * @private
   * @param {string} policyId - Policy UUID.
   * @param {CreatePolicyStatementPayload[]} statements - Statement payloads.
   * @return {Promise<PolicyStatement[]>} Created statements with expression links.
   * @memberof PolicyService
   */
  private async createStatements(
    policyId: string,
    statements: CreatePolicyStatementPayload[]
  ): Promise<PolicyStatement[]> {
    return Promise.all(
      statements.map(async (stmt) => {
        const statement = await this.policyStatementService.createPolicyStatement({
          policy_id: policyId,
          effect: stmt.effect,
          submission_feature_urn: stmt.submission_feature_urn,
          policy_expression_id: stmt.policy_expression_id
        });
        return statement;
      })
    );
  }
}
