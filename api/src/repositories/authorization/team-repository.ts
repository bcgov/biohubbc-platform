import { Knex } from 'knex';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CountResult } from '../../models/count';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
import { TeamFilters } from '../../services/access-policy/team-service.interface';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing team data.
 *
 * @export
 * @class TeamRepository
 * @extends {BaseRepository}
 */
export class TeamRepository extends BaseRepository {
  /**
   * Insert a new team record.
   *
   * @param {CreateTeam} teamData - The data for the team to insert.
   * @return {Promise<Team>} - The created team record.
   * @memberof TeamRepository
   */
  async insertTeam(teamData: CreateTeam): Promise<Team> {
    const knex = getKnex();
    const query = knex
      .table('team')
      .insert({
        name: teamData.name,
        description: teamData.description
      })
      .returning(['team_id', 'name', 'description', knex.raw('0::int as member_count')]);

    const response = await this.connection.knex(query, Team);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert team', [
        'TeamRepository->insertTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a team record by ID.
   *
   * @param {string} teamId - The ID of the team to retrieve.
   * @return {Promise<Team>} - The team record.
   * @memberof TeamRepository
   */
  async getTeam(teamId: string): Promise<Team> {
    const knex = getKnex();
    const query = knex
      .from('team as t')
      .leftJoin('team_member as tm', function () {
        this.on('t.team_id', '=', 'tm.team_id').andOnNull('tm.record_end_date');
      })
      .select(['t.team_id', 't.name', 't.description', knex.raw('COUNT(tm.team_member_id)::int as member_count')])
      .whereNull('t.record_end_date')
      .where('t.team_id', teamId)
      .groupBy(['t.team_id', 't.name', 't.description']);

    const response = await this.connection.knex(query, Team);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Team not found', ['TeamRepository->getTeam', { teamId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'TeamRepository->getTeam',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find a single active team record by its exact name.
   *
   * The partial unique index `team_nuk1` guarantees at most one active team per name, so this
   * returns either the matching team or `null`.
   *
   * @param {string} name - The exact team name to look up.
   * @return {Promise<Team | null>} - The matching team, or `null` if none exists.
   * @memberof TeamRepository
   */
  async findTeamByName(name: string): Promise<Team | null> {
    const knex = getKnex();
    const query = knex
      .from('team as t')
      .leftJoin('team_member as tm', function () {
        this.on('t.team_id', '=', 'tm.team_id').andOnNull('tm.record_end_date');
      })
      .select(['t.team_id', 't.name', 't.description', knex.raw('COUNT(tm.team_member_id)::int as member_count')])
      .whereNull('t.record_end_date')
      .where('t.name', name)
      .groupBy(['t.team_id', 't.name', 't.description']);

    const response = await this.connection.knex(query, Team);

    return response.rows[0] ?? null;
  }

  /**
   * Get teams with optional search and pagination, including active member count.
   *
   * @param {TeamFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Team[]>}
   * @memberof TeamRepository
   */
  async getTeams(filters?: TeamFilters, pagination?: ApiPaginationOptions): Promise<Team[]> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(knex.table('team as t').whereNull('t.record_end_date'), filters);

    const query = baseQuery
      .clone()
      .leftJoin('team_member as tm', function () {
        this.on('t.team_id', '=', 'tm.team_id').andOnNull('tm.record_end_date');
      })
      .select(['t.team_id', 't.name', 't.description', knex.raw('COUNT(tm.team_member_id)::int as member_count')])
      .groupBy(['t.team_id', 't.name', 't.description']);

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, Team);

    return response.rows;
  }

  /**
   * Get count of teams matching optional search criteria.
   *
   * @param {TeamFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof TeamRepository
   */
  async getTeamsCount(filters?: TeamFilters): Promise<number> {
    const knex = getKnex();
    const baseQuery = this.applyFilters(knex.table('team as t').whereNull('t.record_end_date'), filters);

    const countQuery = baseQuery.clone().select(knex.raw('coalesce(count(*), 0)::integer as count')).first();
    const countResult = await this.connection.knex(countQuery, CountResult);
    return countResult.rows[0].count;
  }

  /**
   * Update an existing team record.
   *
   * @param {string} teamId - The ID of the team to update.
   * @param {UpdateTeam} teamData - The data to update.
   * @return {Promise<void>}
   * @memberof TeamRepository
   */
  async updateTeam(teamId: string, teamData: UpdateTeam): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('team')
      .update({
        name: teamData.name,
        description: teamData.description
      })
      .where('team_id', teamId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update team', [
        'TeamRepository->updateTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Soft delete a team record by ID.
   *
   * @param {string} teamId - The ID of the team to delete.
   * @return {Promise<void>}
   * @memberof TeamRepository
   */
  async deleteTeam(teamId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('team')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('team_id', teamId)
      .returning(['team_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete team', [
        'TeamRepository->deleteTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Apply team list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {TeamFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: TeamFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.search) {
      query.whereILike('t.name', `%${filters.search}%`);
    }

    return query;
  }
}
