import { Knex } from 'knex';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CountResult } from '../../models/count';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { TeamPolicyFilters } from '../../services/access-policy/team-policy-service.interface';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing team policy data.
 *
 * @export
 * @class TeamPolicyRepository
 * @extends {BaseRepository}
 */
export class TeamPolicyRepository extends BaseRepository {
  /**
   * Insert a new team policy record.
   *
   * @param {CreateTeamPolicy} teamPolicyData - The data for the team policy to insert.
   * @return {Promise<TeamPolicy>} - The created team policy record.
   * @memberof TeamPolicyRepository
   */
  async insertTeamPolicy(teamPolicyData: CreateTeamPolicy): Promise<TeamPolicy> {
    const knex = getKnex();
    const query = knex
      .table('team_policy')
      .insert({
        team_id: teamPolicyData.team_id,
        policy_id: teamPolicyData.policy_id
      })
      .returning(['team_policy_id', 'team_id', 'policy_id']);

    const response = await this.connection.knex(query, TeamPolicy);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert team policy', [
        'TeamPolicyRepository->insertTeamPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a team policy record by ID.
   *
   * @param {string} teamPolicyId - The ID of the team policy to retrieve.
   * @return {Promise<TeamPolicy>} - The team policy record.
   * @memberof TeamPolicyRepository
   */
  async getTeamPolicy(teamPolicyId: string): Promise<TeamPolicy> {
    const knex = getKnex();
    const query = knex
      .table('team_policy')
      .select(['team_policy_id', 'team_id', 'policy_id'])
      .where('team_policy_id', teamPolicyId);

    const response = await this.connection.knex(query, TeamPolicy);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Team policy not found', ['TeamPolicyRepository->getTeamPolicy', { teamPolicyId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'TeamPolicyRepository->getTeamPolicy',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active team policy records with optional filters and pagination.
   *
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<TeamPolicyDetails[]>} - A list of matching active team policy records.
   * @memberof TeamPolicyRepository
   */
  async getTeamPolicies(filters?: TeamPolicyFilters, pagination?: ApiPaginationOptions): Promise<TeamPolicyDetails[]> {
    const knex = getKnex();
    const query = knex
      .select(['tp.team_policy_id', 'tp.team_id', 'tp.policy_id', 't.name as team_name', 'p.name as policy_name'])
      .from('team_policy as tp')
      .innerJoin('team as t', 'tp.team_id', 't.team_id')
      .innerJoin('policy as p', 'tp.policy_id', 'p.policy_id')
      .whereNull('tp.record_end_date')
      .whereNull('t.record_end_date')
      .whereNull('p.record_end_date');

    this.applyFilters(query, filters);

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, TeamPolicyDetails);

    return response.rows;
  }

  /**
   * Get active team policy records for a specific team with optional filters and pagination.
   *
   * @param {string} teamId - Team ID.
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<TeamPolicyDetails[]>} - A list of matching active team policy records.
   * @memberof TeamPolicyRepository
   */
  async getPoliciesByTeamId(
    teamId: string,
    filters?: TeamPolicyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<TeamPolicyDetails[]> {
    const knex = getKnex();
    const query = knex
      .select(['tp.team_policy_id', 'tp.team_id', 'tp.policy_id', 't.name as team_name', 'p.name as policy_name'])
      .from('team_policy as tp')
      .innerJoin('team as t', 'tp.team_id', 't.team_id')
      .innerJoin('policy as p', 'tp.policy_id', 'p.policy_id')
      .whereNull('tp.record_end_date')
      .whereNull('t.record_end_date')
      .whereNull('p.record_end_date')
      .where('tp.team_id', teamId);

    this.applyFilters(query, filters);

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, TeamPolicyDetails);

    return response.rows;
  }

  /**
   * Get count of active team-policy associations matching optional filters.
   *
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof TeamPolicyRepository
   */
  async getAllTeamPoliciesCount(filters?: TeamPolicyFilters): Promise<number> {
    const knex = getKnex();
    const query = knex
      .from('team_policy as tp')
      .innerJoin('team as t', 'tp.team_id', 't.team_id')
      .innerJoin('policy as p', 'tp.policy_id', 'p.policy_id')
      .whereNull('tp.record_end_date')
      .whereNull('t.record_end_date')
      .whereNull('p.record_end_date')
      .select(knex.raw('coalesce(count(*), 0)::integer as count'))
      .first();

    this.applyFilters(query, filters);

    const response = await this.connection.knex(query, CountResult);
    return response.rows[0].count;
  }

  /**
   * Update an existing team policy record.
   *
   * @param {string} teamPolicyId - The ID of the team policy to update.
   * @param {UpdateTeamPolicy} teamPolicyData - The data to update.
   * @return {Promise<TeamPolicy>} - The updated team policy record.
   * @memberof TeamPolicyRepository
   */
  async updateTeamPolicy(teamPolicyId: string, teamPolicyData: UpdateTeamPolicy): Promise<TeamPolicy> {
    const knex = getKnex();
    const query = knex
      .table('team_policy')
      .update({
        record_end_date: teamPolicyData.record_end_date
      })
      .where('team_policy_id', teamPolicyId)
      .returning(['team_policy_id', 'team_id', 'policy_id']);

    const response = await this.connection.knex(query, TeamPolicy);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update team policy', [
        'TeamPolicyRepository->updateTeamPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a team policy record by ID.
   *
   * @param {string} teamPolicyId - The ID of the team policy to delete.
   * @return {Promise<void>}
   * @memberof TeamPolicyRepository
   */
  async deleteTeamPolicy(teamPolicyId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('team_policy')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('team_policy_id', teamPolicyId)
      .returning(['team_policy_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete team policy', [
        'TeamPolicyRepository->deleteTeamPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Apply team-policy list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: TeamPolicyFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.policyIds?.length) {
      query.whereIn('tp.policy_id', filters.policyIds);
    }

    if (filters.search) {
      query.where((builder) => {
        builder.whereILike('t.name', `%${filters.search}%`).orWhereILike('p.name', `%${filters.search}%`);
      });
    }

    return query;
  }
}
