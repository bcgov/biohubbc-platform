import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { FeatureUrn } from '../../database/urn-utils.interface';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CountResult } from '../../models/count';
import { CreatePolicy, Policy, UpdatePolicy } from '../../models/policy';
import { PolicyEffect } from '../../models/policy-statement';
import { PolicyFilters } from '../../services/access-policy/policy-service.interface';
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
        description: policyData.description,
        record_end_date: policyData.record_end_date,
        status: policyData.status
      })
      .returning(['policy_id', 'name', 'description', 'status']);

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
    const response = await this.getPolicies({ policyId });

    if (response.length === 0) {
      throw new ApiNotFoundError('Policy not found', ['PolicyRepository->getPolicy', { policyId }]);
    }

    if (response.length !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyRepository->getPolicy',
        `expected rowCount=1, actual rowCount=${response.length}`
      ]);
    }

    return response[0];
  }

  /**
   * Get policies with optional search and pagination.
   *
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Policy[]>}
   * @memberof PolicyRepository
   */
  async getPolicies(filters?: PolicyFilters, pagination?: ApiPaginationOptions): Promise<Policy[]> {
    const knex = getKnex();
    const query = this.applyFilters(knex.table('policy').whereNull('record_end_date'), filters).select([
      'policy_id',
      'name',
      'description',
      'status'
    ]);

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, Policy);
    return response.rows;
  }

  /**
   * Get count of policies matching optional filters.
   *
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof PolicyRepository
   */
  async getPoliciesCount(filters?: PolicyFilters): Promise<number> {
    const knex = getKnex();
    const query = this.applyFilters(knex.table('policy').whereNull('record_end_date'), filters)
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    const response = await this.connection.knex(query, CountResult);
    return response.rows[0].count;
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
        AND (p.record_end_date IS NULL OR p.record_end_date > NOW())
        AND p.status = 'approved'
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
        record_end_date: policyData.record_end_date,
        status: policyData.status
      })
      .where('policy_id', policyId)
      .returning(['policy_id', 'name', 'description', 'status']);

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

  /**
   * Apply policy list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {PolicyFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: PolicyFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.search) {
      query.whereILike('name', `%${filters.search}%`);
    }

    if (filters.policyId) {
      query.where('policy_id', filters.policyId);
    }

    return query;
  }
}
