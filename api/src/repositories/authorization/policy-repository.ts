import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { FeatureUrn } from '../../database/urn-utils.interface';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyEffect } from '../../models/policy-statement';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
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
   * Get all policy records.
   *
   * @return {Promise<Policy[]>} - A list of all policy records.
   * @memberof PolicyRepository
   */
  async getPolicies(): Promise<Policy[]> {
    const knex = getKnex();
    const query = knex.table('policy').select(['policy_id', 'name', 'description']);

    const response = await this.connection.knex(query, Policy);

    return response.rows;
  }

  /**
   * Get policies with pagination and optional search.
   *
   * @param {string} [search] - Optional search term to filter by policy name.
   * @param {ApiPaginationOptions} pagination - Pagination options.
   * @return {Promise<{ policies: Policy[]; total: number }>} - Paginated policies and total count.
   * @memberof PolicyRepository
   */
  async getPoliciesWithPagination(
    search: string | undefined,
    pagination: ApiPaginationOptions
  ): Promise<{ policies: Policy[]; total: number }> {
    const knex = getKnex();

    let baseQuery = knex.table('policy').where('record_end_date', null);

    if (search) {
      baseQuery = baseQuery.whereILike('name', `%${search}%`);
    }

    // Get total count
    const countQuery = baseQuery.clone().count('* as count').first();
    const countResult = await this.connection.knex(countQuery);
    const total = Number(countResult.rows[0]?.count || 0);

    // Get paginated results (page is 1-indexed, so offset = (page - 1) * limit)
    const paginatedQuery = baseQuery
      .clone()
      .select(['policy_id', 'name', 'description'])
      .orderBy(pagination.sort || 'name', pagination.order || 'asc')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    const response = await this.connection.knex(paginatedQuery, Policy);

    return { policies: response.rows, total };
  }

  /**
   * Returns all policies that authorize access to the given feature URN for the given user.
   *
   * NOTE: We can optimize queries that use URNs by storing the URN components individually and indexing each.
   * This query currently repeats split_part as a temporary implementation, but this should be optimized using DB indexes.
   *
   * @param {FeatureUrn} urnParts
   * @param {number} systemUserId
   * @return {Promise<Policy[]>} - The policy records.
   * @memberof PolicyRepository
   */
  async getPoliciesThatAuthorizeFeatureAccessByUrn(urnParts: FeatureUrn, systemUserId: number): Promise<Policy[]> {
    const sql = SQL`
      WITH policy_urn_parts AS (
        SELECT
          ps.*,
          split_part(ps.submission_feature_urn, ':', 2) AS part1,  -- submissionId
          split_part(ps.submission_feature_urn, ':', 3) AS part2,  -- featureTypeName
          split_part(ps.submission_feature_urn, ':', 4) AS part3   -- submissionFeatureId
        FROM policy_statement ps
        WHERE ps.record_end_date IS NULL
          AND ps.effect = ${PolicyEffect.ALLOW}
      )
      SELECT DISTINCT p.*
      FROM policy p
      INNER JOIN team_policy tp 
        ON tp.policy_id = p.policy_id 
        AND tp.record_end_date IS NULL
      INNER JOIN team_member tm 
        ON tm.team_id = tp.team_id 
        AND tm.record_end_date IS NULL
      INNER JOIN policy_urn_parts ps 
        ON ps.policy_id = p.policy_id
      WHERE tm.system_user_id = ${systemUserId}
        AND p.record_end_date IS NULL
        AND (ps.part1 = ${urnParts.submissionId} OR ps.part1 = '*')
        AND (ps.part2 = ${urnParts.featureTypeName} OR ps.part2 = '*')
        AND (ps.part3 = ${urnParts.submissionFeatureId} OR ps.part3 = '*')
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
   * Soft delete a policy record by ID.
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
