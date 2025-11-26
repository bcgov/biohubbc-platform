import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
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
      .returning(['team_id', 'name', 'description']);

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
    const query = knex.table('team').select(['team_id', 'name', 'description']).where('team_id', teamId);

    const response = await this.connection.knex(query, Team);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get team', [
        'TeamRepository->getTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all team records.
   *
   * @return {Promise<Team[]>} - A list of all team records.
   * @memberof TeamRepository
   */
  async getTeams(): Promise<Team[]> {
    const knex = getKnex();
    const query = knex.table('team').select(['team_id', 'name', 'description']);

    const response = await this.connection.knex(query, Team);

    return response.rows;
  }

  /**
   * Update an existing team record.
   *
   * @param {string} teamId - The ID of the team to update.
   * @param {UpdateTeam} teamData - The data to update.
   * @return {Promise<Team>} - The updated team record.
   * @memberof TeamRepository
   */
  async updateTeam(teamId: string, teamData: UpdateTeam): Promise<Team> {
    const knex = getKnex();
    const query = knex
      .table('team')
      .update({
        name: teamData.name,
        description: teamData.description,
        record_end_date: teamData.record_end_date
      })
      .where('team_id', teamId)
      .returning(['team_id', 'name', 'description']);

    const response = await this.connection.knex(query, Team);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update team', [
        'TeamRepository->updateTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
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
}
