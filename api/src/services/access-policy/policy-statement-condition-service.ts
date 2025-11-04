import { IDBConnection } from '../../database/db';
import {
  CreatePolicyStatementCondition,
  PolicyStatementCondition,
  UpdatePolicyStatementCondition
} from '../../models/policy-statement-condition';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { DBService } from '../db-service';

export class PolicyStatementConditionService extends DBService {
  policyStatementConditionRepository: PolicyStatementConditionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementConditionRepository = new PolicyStatementConditionRepository(connection);
  }

  /**
   * Create a new policy statement condition record.
   *
   * @param {CreatePolicyStatementCondition} policyStatementConditionData - Data required to create a new policy statement condition.
   * @return {Promise<PolicyStatementCondition>} - The created policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  createPolicyStatementCondition(
    policyStatementConditionData: CreatePolicyStatementCondition
  ): Promise<PolicyStatementCondition> {
    return this.policyStatementConditionRepository.insertPolicyStatementCondition(policyStatementConditionData);
  }

  /**
   * Retrieve a policy statement condition record
   *
   * @param {string} policyStatementConditionId - The ID of the policy statement condition to fetch.
   * @return {Promise<PolicyStatementCondition>} - The policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  getPolicyStatementCondition(policyStatementConditionId: string): Promise<PolicyStatementCondition> {
    return this.policyStatementConditionRepository.getPolicyStatementCondition(policyStatementConditionId);
  }

  /**
   * Update an existing policy statement condition record.
   *
   * @param {string} policyStatementConditionId - The ID of the policy statement condition to update.
   * @param {UpdatePolicyStatementCondition} policyStatementConditionData - Partial data to update the policy statement condition record.
   * @return {Promise<PolicyStatementCondition>} - The updated policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  updatePolicyStatementCondition(
    policyStatementConditionId: string,
    policyStatementConditionData: UpdatePolicyStatementCondition
  ): Promise<PolicyStatementCondition> {
    return this.policyStatementConditionRepository.updatePolicyStatementCondition(
      policyStatementConditionId,
      policyStatementConditionData
    );
  }

  /**
   * Delete a policy statement condition record.
   *
   * @param {string} policyStatementConditionId - The id of the policy statement condition to delete
   * @return {Promise<void>}
   * @memberof PolicyStatementConditionService
   */
  async deletePolicyStatementCondition(policyStatementConditionId: string): Promise<void> {
    await this.policyStatementConditionRepository.deletePolicyStatementCondition(policyStatementConditionId);
  }
}
