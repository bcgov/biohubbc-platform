import { IDBConnection } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP400 } from '../../errors/http-error';
import { CreatePolicyStatementCondition, PolicyStatementCondition } from '../../models/policy-statement-condition';
import { CodeRepository } from '../../repositories/code-repository';
import { PolicyStatementConditionRepository } from '../../repositories/authorization/policy-statement-condition-repository';
import { DBService } from '../db-service';
import { validatePolicyConditionInput } from './policy-condition-validation';

export class PolicyStatementConditionService extends DBService {
  codeRepository: CodeRepository;
  policyStatementConditionRepository: PolicyStatementConditionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.codeRepository = new CodeRepository(connection);
    this.policyStatementConditionRepository = new PolicyStatementConditionRepository(connection);
  }

  /**
   * Create a new policy statement condition record.
   *
   * @param {CreatePolicyStatementCondition} policyStatementConditionData - Data required to create a new policy statement condition.
   * @return {Promise<PolicyStatementCondition>} - The created policy statement condition record.
   * @memberof PolicyStatementConditionService
   */
  async createPolicyStatementCondition(
    policyStatementConditionData: CreatePolicyStatementCondition
  ): Promise<PolicyStatementCondition> {
    try {
      const featureProperty = await this.codeRepository.getFeaturePropertyByName(policyStatementConditionData.key);
      validatePolicyConditionInput(
        policyStatementConditionData.key,
        policyStatementConditionData.operator,
        policyStatementConditionData.value,
        featureProperty.feature_property_type_name
      );
    } catch (error) {
      if (error instanceof ApiNotFoundError) {
        throw new HTTP400(`Invalid policy condition key: ${policyStatementConditionData.key}`);
      }

      throw error;
    }

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
   * Retrieve all policy statement condition records for a given policy statement.
   *
   * @param {string} policyStatementId - The ID of the policy statement to fetch conditions for.
   * @return {Promise<PolicyStatementCondition[]>} - The policy statement condition records.
   * @memberof PolicyStatementConditionService
   */
  getPolicyStatementConditions(policyStatementId: string): Promise<PolicyStatementCondition[]> {
    return this.policyStatementConditionRepository.getPolicyStatementConditions(policyStatementId);
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
