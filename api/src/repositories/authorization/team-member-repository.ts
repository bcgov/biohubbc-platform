import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateTeamMember, TeamMember, UpdateTeamMember } from '../../models/team-member';
import { BaseRepository } from '../base-repository';

/**
 * A team member with user details.
 */
export const TeamMemberWithUser = z.object({
  team_member_id: z.string().uuid(),
  system_user_id: z.number(),
  user_identifier: z.string()
});

export type TeamMemberWithUser = z.infer<typeof TeamMemberWithUser>;

/**
 * A repository class for accessing team member data.
 *
 * @export
 * @class TeamMemberRepository
 * @extends {BaseRepository}
 */
export class TeamMemberRepository extends BaseRepository {
  /**
   * Insert a new team member record.
   *
   * @param {CreateTeamMember} teamMemberData - The data for the team member to insert.
   * @return {Promise<TeamMember>} - The created team member record.
   * @memberof TeamMemberRepository
   */
  async insertTeamMember(teamMemberData: CreateTeamMember): Promise<TeamMember> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .insert({
        system_user_id: teamMemberData.system_user_id,
        team_id: teamMemberData.team_id
      })
      .returning(['team_member_id', 'system_user_id', 'team_id']);

    const response = await this.connection.knex(query, TeamMember);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert team member', [
        'TeamMemberRepository->insertTeamMember',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a team member record by ID.
   *
   * @param {string} teamMemberId - The ID of the team member to retrieve.
   * @return {Promise<TeamMember>} - The team member record.
   * @memberof TeamMemberRepository
   */
  async getTeamMember(teamMemberId: string): Promise<TeamMember> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .select(['team_member_id', 'system_user_id', 'team_id'])
      .where('team_member_id', teamMemberId);

    const response = await this.connection.knex(query, TeamMember);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get team member', [
        'TeamMemberRepository->getTeamMember',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all team members for a given team.
   *
   * @param {string} teamId - The ID of the team whose members to retrieve.
   * @return {Promise<TeamMember[]>} - A list of team member records.
   * @memberof TeamMemberRepository
   */
  async getTeamMembersByTeamId(teamId: string): Promise<TeamMember[]> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .select(['team_member_id', 'system_user_id', 'team_id'])
      .where('team_id', teamId);

    const response = await this.connection.knex(query, TeamMember);

    return response.rows;
  }

  /**
   * Update an existing team member record.
   *
   * @param {string} teamMemberId - The ID of the team member to update.
   * @param {UpdateTeamMember} teamMemberData - The data to update.
   * @return {Promise<TeamMember>} - The updated team member record.
   * @memberof TeamMemberRepository
   */
  async updateTeamMember(teamMemberId: string, teamMemberData: UpdateTeamMember): Promise<TeamMember> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .update({
        record_end_date: teamMemberData.record_end_date
      })
      .where('team_member_id', teamMemberId)
      .returning(['team_member_id', 'system_user_id', 'team_id']);

    const response = await this.connection.knex(query, TeamMember);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update team member', [
        'TeamMemberRepository->updateTeamMember',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a team member record by ID.
   *
   * @param {string} teamMemberId - The ID of the team member to delete.
   * @return {Promise<void>}
   * @memberof TeamMemberRepository
   */
  async deleteTeamMember(teamMemberId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('team_member_id', teamMemberId)
      .returning(['team_member_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete team member', [
        'TeamMemberRepository->deleteTeamMember',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get team members with user details for a given team.
   *
   * @param {string} teamId - The ID of the team.
   * @return {Promise<TeamMemberWithUser[]>}
   * @memberof TeamMemberRepository
   */
  async getTeamMembersWithUsers(teamId: string): Promise<TeamMemberWithUser[]> {
    const knex = getKnex();
    const query = knex
      .table('team_member as tm')
      .select(['tm.team_member_id', 'tm.system_user_id', 'su.user_identifier'])
      .innerJoin('system_user as su', 'tm.system_user_id', 'su.system_user_id')
      .where('tm.team_id', teamId)
      .whereNull('tm.record_end_date')
      .orderBy('su.user_identifier', 'asc');

    const response = await this.connection.knex(query, TeamMemberWithUser);
    return response.rows;
  }
}
