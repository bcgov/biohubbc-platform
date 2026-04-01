import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import {
  CreatePolicyStatementInput,
  PolicyFilters,
  PolicyStatementWithConditions,
  PolicyWithStatements
} from './policy-service.interface';
import { PolicyStatementConditionService } from './policy-statement-condition-service';
import { PolicyStatementService } from './policy-statement-service';
import { SecurityScopeService } from './security-scope-service';

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyStatementConditionService: PolicyStatementConditionService;
  securityScopeService: SecurityScopeService;
  teamPolicyRepository: TeamPolicyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyRepository = new PolicyRepository(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.policyStatementConditionService = new PolicyStatementConditionService(connection);
    this.securityScopeService = new SecurityScopeService(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Create a new policy record.
   *
   * @param {CreatePolicy} policyData - Data required to create a new policy.
   * @return {Promise<Policy>} - The created policy record.
   * @memberof PolicyService
   */
  createPolicy(policyData: CreatePolicy): Promise<Policy> {
    return this.policyRepository.insertPolicy(policyData);
  }

  /**
   * Retrieve a policy record
   *
   * @param {string} policyId - The ID of the policy to fetch.
   * @return {Promise<Policy>}
   * @memberof PolicyService
   */
  getPolicy(policyId: string): Promise<Policy> {
    return this.policyRepository.getPolicy(policyId);
  }

  /**
   * Retrieve policies with optional filters and pagination.
   *
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Policy[]>}
   * @memberof PolicyService
   */
  getPolicies(filters?: PolicyFilters, pagination?: ApiPaginationOptions): Promise<Policy[]> {
    return this.policyRepository.getPolicies(filters, pagination);
  }

  /**
   * Retrieve count of policies matching optional filters.
   *
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof PolicyService
   */
  getPoliciesCount(filters?: PolicyFilters): Promise<number> {
    return this.policyRepository.getPoliciesCount(filters);
  }

  /**
   * Retrieve a policy record
   *
   * @param {string} urn
   * @param {number} systemUserId
   * @return {Promise<Policy[]>}
   * @memberof PolicyService
   */
  getPoliciesThatAuthorizeFeatureAccessByUrn(urn: string, systemUserId: number): Promise<Policy[]> {
    const urnParts = parseFeatureUrn(urn);
    return this.policyRepository.getPoliciesThatAuthorizeFeatureAccessByUrn(urnParts, systemUserId);
  }

  /**
   * Update an existing policy record.
   *
   * @param {string} policyId - The ID of the policy to update.
   * @param {UpdatePolicy} policyData - Partial data to update the policy record.
   * @return {Promise<Policy>} - The updated policy record.
   * @memberof PolicyService
   */
  updatePolicy(policyId: string, policyData: UpdatePolicy): Promise<Policy> {
    return this.policyRepository.updatePolicy(policyId, policyData);
  }

  /**
   * Delete a policy and clean up its security scope mappings.
   *
   * Must fetch affected team IDs and statement IDs BEFORE soft-deleting the policy,
   * because after soft-delete the team_policy JOIN won't find the policy and
   * getPolicyStatements filters on record_end_date IS NULL.
   *
   * @param {string} policyId - The id of the policy to delete
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  async deletePolicy(policyId: string): Promise<void> {
    // Gather affected teams and statements before soft-delete makes them unreachable
    const [teamPolicies, statements] = await Promise.all([
      this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] }),
      this.policyStatementService.getPolicyStatements(policyId)
    ]);

    const affectedTeamIds = teamPolicies.map((tp) => tp.team_id);
    const statementIds = statements.map((s) => s.policy_statement_id);

    // Soft-delete the policy
    await this.policyRepository.deletePolicy(policyId);

    // Clean up derived scope mappings and rebuild affected teams' scope grants
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
   * Get a single policy with its statements and conditions.
   *
   * @param {string} policyId - The ID of the policy to fetch.
   * @return {Promise<PolicyWithStatements>}
   * @memberof PolicyService
   */
  async getPolicyWithStatements(policyId: string): Promise<PolicyWithStatements> {
    const policy = await this.policyRepository.getPolicy(policyId);
    const statements = await this.getStatementsWithConditions(policyId);
    return { ...policy, statements };
  }

  /**
   * Get statements for a policy, including conditions.
   *
   * @param {string} policyId - The ID of the policy.
   * @return {Promise<PolicyStatementWithConditions[]>}
   * @memberof PolicyService
   */
  async getStatementsWithConditions(policyId: string): Promise<PolicyStatementWithConditions[]> {
    const statements = await this.policyStatementService.getPolicyStatements(policyId);

    return Promise.all(
      statements.map(async (stmt) => ({
        ...stmt,
        conditions: await this.policyStatementConditionService.getPolicyStatementConditions(stmt.policy_statement_id)
      }))
    );
  }

  /**
   * Create a policy with statements and conditions.
   *
   * @param {CreatePolicy} policyData - Data required to create a new policy.
   * @param {CreatePolicyStatementInput[]} statements - Statements to create for the policy.
   * @return {Promise<PolicyWithStatements>}
   * @memberof PolicyService
   */
  async createPolicyWithStatements(
    policyData: CreatePolicy,
    statements: CreatePolicyStatementInput[]
  ): Promise<PolicyWithStatements> {
    const policy = await this.createPolicy(policyData);
    const createdStatements = await this.createStatementsWithScopes(policy.policy_id, statements);
    return { ...policy, statements: createdStatements };
  }

  /**
   * Update a policy with statements and conditions.
   * Strategy: Delete existing statements and recreate (simpler than diffing).
   *
   * Note: When a statement's URN changes, the old security_scope row may become
   * orphaned (no policy_statement_scope references it). We intentionally skip
   * cleanup because the same scope may still be referenced by other statements
   * via the shared scope_hash. Orphaned scopes are low-cost (~500 rows at scale).
   *
   * @param {string} policyId - The ID of the policy to update.
   * @param {UpdatePolicy} policyData - Partial data to update the policy record.
   * @param {CreatePolicyStatementInput[]} statements - New statements for the policy.
   * @return {Promise<PolicyWithStatements>}
   * @memberof PolicyService
   */
  async updatePolicyWithStatements(
    policyId: string,
    policyData: UpdatePolicy,
    statements: CreatePolicyStatementInput[]
  ): Promise<PolicyWithStatements> {
    const policy = await this.updatePolicy(policyId, policyData);

    // Collect old statement IDs and affected teams before soft-deleting statements.
    // After soft-delete, the policy_statement_scope mappings must be cleaned up
    // and affected teams' scope grants rebuilt from the remaining active chain.
    const existingStatements = await this.policyStatementService.getPolicyStatements(policyId);
    const oldStatementIds = existingStatements.map((s) => s.policy_statement_id);

    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    const affectedTeamIds = teamPolicies.map((tp) => tp.team_id);

    // Soft-delete old statements
    await Promise.all(
      existingStatements.map((stmt) => this.policyStatementService.deletePolicyStatement(stmt.policy_statement_id))
    );

    // Create new statements
    const createdStatements = await this.createStatementsWithScopes(policyId, statements);

    // Clean up old scope mappings and rebuild affected teams' scope grants
    if (oldStatementIds.length > 0) {
      await this.securityScopeService.cleanupScopesForDeletedStatements(oldStatementIds, affectedTeamIds);
    }

    return { ...policy, statements: createdStatements };
  }

  /**
   * Create statements with conditions and register security scopes for each.
   * Shared by createPolicyWithStatements and updatePolicyWithStatements.
   */
  private async createStatementsWithScopes(
    policyId: string,
    statements: CreatePolicyStatementInput[]
  ): Promise<PolicyStatementWithConditions[]> {
    const createdStatements = await Promise.all(
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

        return { ...statement, conditions };
      })
    );

    for (const stmt of createdStatements) {
      await this.securityScopeService.createScopeForPolicyStatement(
        stmt.policy_statement_id,
        stmt.submission_feature_urn
      );
    }

    return createdStatements;
  }
}
