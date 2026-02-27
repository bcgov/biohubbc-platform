import { IDBConnection } from '../../database/db';
import { parseFeatureUrn } from '../../database/urn-utils';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyRepository } from '../../repositories/authorization/policy-repository';
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

export class PolicyService extends DBService {
  policyRepository: PolicyRepository;
  policyStatementService: PolicyStatementService;
  policyStatementConditionService: PolicyStatementConditionService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyRepository = new PolicyRepository(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.policyStatementConditionService = new PolicyStatementConditionService(connection);
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
   * Delete a policy record.
   *
   * @param {string} policyId - The id of the policy to delete
   * @return {Promise<void>}
   * @memberof PolicyService
   */
  deletePolicy(policyId: string): Promise<void> {
    return this.policyRepository.deletePolicy(policyId);
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

    const createdStatements = await Promise.all(
      statements.map(async (stmt) => {
        const statement = await this.policyStatementService.createPolicyStatement({
          policy_id: policy.policy_id,
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

    return { ...policy, statements: createdStatements };
  }

  /**
   * Update a policy with statements and conditions.
   * Strategy: Delete existing statements and recreate (simpler than diffing).
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

    // Delete existing statements (soft delete)
    const existingStatements = await this.policyStatementService.getPolicyStatements(policyId);
    await Promise.all(
      existingStatements.map((stmt) => this.policyStatementService.deletePolicyStatement(stmt.policy_statement_id))
    );

    // Create new statements
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

    return { ...policy, statements: createdStatements };
  }
}
