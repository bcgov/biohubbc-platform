import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing policy data.
 *
 * @export
 * @class PolicyRepository
 * @extends {BaseRepository}
 */
export class PolicyRepository extends BaseRepository {
  /**
   * Insert a new policy record.
   *
   * @param {CreatePolicy} policyData - The data for the policy to insert.
   * @return {Promise<Policy>} - The created policy record.
   * @memberof PolicyRepository
   */
  async insertPolicy(policyData: CreatePolicy): Promise<Policy> {
    const knex = getKnex();

    const query = knex
      .table('policy')
      .insert({
        name: policyData.name,
        description: policyData.description
      })
      .returning(['policy_id', 'name', 'description']);

    const response = await this.connection.knex(query, Policy);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy', [
        'PolicyRepository->insertPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a policy record by ID.
   *
   * @param {string} policyId - The ID of the policy to retrieve.
   * @return {Promise<Policy>} - The policy record.
   * @memberof PolicyRepository
   */
  async getPolicy(policyId: string): Promise<Policy> {
    const knex = getKnex();
    const query = knex.table('policy').select(['policy_id', 'name', 'description']).where('policy_id', policyId);

    const response = await this.connection.knex(query, Policy);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get policy', [
        'PolicyRepository->getPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Check whether a user can access a feature urn
   *
   * @param {string} urn
   * @param {number} systemUserId
   * @return {Promise<Policy[]>} - The policy record.
   * @memberof PolicyRepository
   */
  async getPoliciesThatAuthorizeFeatureAccessByUrn(urn: string, systemUserId: number): Promise<Policy[]> {
    const sql = SQL`
      SELECT DISTINCT p.*
      FROM policy p
      INNER JOIN team_policy tp ON tp.policy_id = p.policy_id AND tp.record_end_date IS NULL
      INNER JOIN team_member tm ON tm.team_id = tp.team_id AND tm.record_end_date IS NULL
      INNER JOIN policy_statement ps ON ps.policy_id = p.policy_id AND ps.record_end_date IS NULL
      WHERE tm.system_user_id = ${systemUserId}
        AND p.record_end_date IS NULL
        AND ps.effect = 'allow'
        AND (
          (split_part(ps.submission_feature_urn, ':', 1) = split_part(${urn}, ':', 1) OR split_part(ps.submission_feature_urn, ':', 1) = '*')
          AND (split_part(ps.submission_feature_urn, ':', 2) = split_part(${urn}, ':', 2) OR split_part(ps.submission_feature_urn, ':', 2) = '*')
          AND (split_part(ps.submission_feature_urn, ':', 3) = split_part(${urn}, ':', 3) OR split_part(ps.submission_feature_urn, ':', 3) = '*')
        )
    `;

    const response = await this.connection.sql(sql, Policy);

    return response.rows;
  }

  /**
   * Update an existing policy record.
   *
   * @param {string} policyId - The ID of the policy to update.
   * @param {UpdatePolicy} policyData - The data to update.
   * @return {Promise<Policy>} - The updated policy record.
   * @memberof PolicyRepository
   */
  async updatePolicy(policyId: string, policyData: UpdatePolicy): Promise<Policy> {
    const knex = getKnex();
    const query = knex
      .table('policy')
      .update({
        name: policyData.name,
        description: policyData.description,
        record_end_date: policyData.record_end_date
      })
      .where('policy_id', policyId)
      .returning(['policy_id', 'name', 'description']);

    const response = await this.connection.knex(query, Policy);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update policy', [
        'PolicyRepository->updatePolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete a policy record by ID.
   *
   * @param {string} policyId - The ID of the policy to delete.
   * @return {Promise<void>} - The deleted policy record.
   * @memberof PolicyRepository
   */
  async deletePolicy(policyId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('policy')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_id', policyId)
      .returning(['policy_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete policy', [
        'PolicyRepository->deletePolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
