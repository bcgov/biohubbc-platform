import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreatePolicyStatementCondition, PolicyStatementCondition } from '../../models/policy-statement-condition';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing policy statement condition data.
 *
 * @export
 * @class PolicyStatementConditionRepository
 * @extends {BaseRepository}
 */
export class PolicyStatementConditionRepository extends BaseRepository {
  /**
   * Insert a new policy statement condition record.
   *
   * @param {CreatePolicyStatementCondition} policyStatementConditionData - The data for the policy statement condition to insert.
   * @return {Promise<PolicyStatementCondition>} - The created policy statement condition record.
   * @memberof PolicyStatementConditionRepository
   */
  async insertPolicyStatementCondition(
    policyStatementConditionData: CreatePolicyStatementCondition
  ): Promise<PolicyStatementCondition> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement_condition')
      .insert({
        policy_statement_id: policyStatementConditionData.policy_statement_id,
        operator: policyStatementConditionData.operator,
        key: policyStatementConditionData.key,
        value: policyStatementConditionData.value
      })
      .returning(['policy_statement_condition_id', 'policy_statement_id', 'operator', 'key', 'value']);

    const response = await this.connection.knex(query, PolicyStatementCondition);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy statement condition', [
        'PolicyStatementConditionRepository->insertPolicyStatementCondition',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a policy statement condition record by ID.
   *
   * @param {string} policyStatementConditionId - The ID of the policy statement condition to retrieve.
   * @return {Promise<PolicyStatementCondition>} - The policy statement condition record.
   * @memberof PolicyStatementConditionRepository
   */
  async getPolicyStatementCondition(policyStatementConditionId: string): Promise<PolicyStatementCondition> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement_condition')
      .select(['policy_statement_condition_id', 'policy_statement_id', 'operator', 'key', 'value'])
      .where('policy_statement_condition_id', policyStatementConditionId);

    const response = await this.connection.knex(query, PolicyStatementCondition);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get policy statement condition', [
        'PolicyStatementConditionRepository->getPolicyStatementCondition',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all policy statement condition records for a given policy statement.
   *
   * @param {string} policyStatementId - The ID of the policy statement to fetch conditions for.
   * @return {Promise<PolicyStatementCondition[]>}
   * @memberof PolicyStatementConditionRepository
   */
  async getPolicyStatementConditions(policyStatementId: string): Promise<PolicyStatementCondition[]> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement_condition')
      .select(['policy_statement_condition_id', 'policy_statement_id', 'operator', 'key', 'value'])
      .where({ policy_statement_id: policyStatementId });

    const response = await this.connection.knex(query, PolicyStatementCondition);

    return response.rows;
  }

  /**
   * Soft delete a policy statement condition record by ID.
   *
   * @param {string} policyStatementConditionId - The ID of the policy statement condition to delete.
   * @return {Promise<void>}
   * @memberof PolicyStatementConditionRepository
   */
  async deletePolicyStatementCondition(policyStatementConditionId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement_condition')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_condition_id', policyStatementConditionId)
      .returning(['policy_statement_condition_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete policy statement condition', [
        'PolicyStatementConditionRepository->deletePolicyStatementCondition',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
