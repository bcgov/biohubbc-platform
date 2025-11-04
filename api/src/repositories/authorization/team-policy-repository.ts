import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateTeamPolicy, TeamPolicy, UpdateTeamPolicy } from '../../models/team-policy';
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

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get team policy', [
        'TeamPolicyRepository->getTeamPolicy',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
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
}
