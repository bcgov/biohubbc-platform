import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreatePolicyStatement, PolicyStatement, UpdatePolicyStatement } from '../../models/policy-statement';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing policy statement data.
 *
 * @export
 * @class PolicyStatementRepository
 * @extends {BaseRepository}
 */
export class PolicyStatementRepository extends BaseRepository {
  /**
   * Insert a new policy statement record.
   *
   * @param {CreatePolicyStatement} policyStatementData - The data for the policy statement to insert.
   * @return {Promise<PolicyStatement>} - The created policy statement record.
   * @memberof PolicyStatementRepository
   */
  async insertPolicyStatement(policyStatementData: CreatePolicyStatement): Promise<PolicyStatement> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .insert({
        policy_id: policyStatementData.policy_id,
        effect: policyStatementData.effect,
        submission_feature_urn: policyStatementData.submission_feature_urn
      })
      .returning(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn']);

    const response = await this.connection.knex(query, PolicyStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy statement', [
        'PolicyStatementRepository->insertPolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a policy statement record by ID.
   *
   * @param {string} policyStatementId - The ID of the policy statement to retrieve.
   * @return {Promise<PolicyStatement>} - The policy statement record.
   * @memberof PolicyStatementRepository
   */
  async getPolicyStatement(policyStatementId: string): Promise<PolicyStatement> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .select(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn'])
      .where('policy_statement_id', policyStatementId);

    const response = await this.connection.knex(query, PolicyStatement);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Policy statement not found', [
        'PolicyStatementRepository->getPolicyStatement',
        { policyStatementId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyStatementRepository->getPolicyStatement',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all policy statement records for a given policy.
   *
   * @param {string} policyId - The ID of the policy to fetch statements for.
   * @return {Promise<PolicyStatement[]>} - A list of policy statement records for the given policy.
   * @memberof PolicyStatementRepository
   */
  async getPolicyStatements(policyId: string): Promise<PolicyStatement[]> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .select(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn'])
      .where('policy_id', policyId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatement);

    return response.rows;
  }

  /**
   * Update an existing policy statement record.
   *
   * @param {string} policyStatementId - The ID of the policy statement to update.
   * @param {UpdatePolicyStatement} policyStatementData - The data to update.
   * @return {Promise<PolicyStatement>} - The updated policy statement record.
   * @memberof PolicyStatementRepository
   */
  async updatePolicyStatement(
    policyStatementId: string,
    policyStatementData: UpdatePolicyStatement
  ): Promise<PolicyStatement> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .update({
        policy_id: policyStatementData.policy_id,
        effect: policyStatementData.effect,
        submission_feature_urn: policyStatementData.submission_feature_urn,
        record_end_date: policyStatementData.record_end_date
      })
      .where('policy_statement_id', policyStatementId)
      .returning(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn']);

    const response = await this.connection.knex(query, PolicyStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update policy statement', [
        'PolicyStatementRepository->updatePolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a policy statement record by ID.
   *
   * @param {string} policyStatementId - The ID of the policy statement to delete.
   * @return {Promise<void>}
   * @memberof PolicyStatementRepository
   */
  async deletePolicyStatement(policyStatementId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_id', policyStatementId)
      .returning(['policy_statement_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete policy statement', [
        'PolicyStatementRepository->deletePolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
