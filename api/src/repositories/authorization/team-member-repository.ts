import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateTeamMember,
  TeamMember,
  TeamMemberByUserFilter,
  TeamMemberWithUser,
  UpdateTeamMember
} from '../../models/team-member';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

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

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Team member not found', ['TeamMemberRepository->getTeamMember', { teamMemberId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'TeamMemberRepository->getTeamMember',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
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
      .where('team_id', teamId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, TeamMember);

    return response.rows;
  }

  /**
   * Get all active team member records for a given system user.
   *
   * @param {number} systemUserId - System user ID.
   * @return {Promise<TeamMember[]>} Team member rows with null `record_end_date`.
   * @memberof TeamMemberRepository
   */
  async getTeamMembersBySystemUserId(systemUserId: number): Promise<TeamMember[]> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .select(['team_member_id', 'system_user_id', 'team_id'])
      .where('system_user_id', systemUserId)
      .whereNull('record_end_date');

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
   * Soft delete all team members for a team
   *
   * @param {string} teamId
   * @return {Promise<void>}
   * @memberof TeamMemberRepository
   */
  async deleteAllTeamMembers(teamId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('team_id', teamId)
      .returning(['team_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete all team members', [
        'TeamMemberRepository->deleteAllTeamMembers',
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
  async getTeamMembersWithUsers(teamId: string, pagination?: ApiPaginationOptions): Promise<TeamMemberWithUser[]> {
    const knex = getKnex();
    const sortFieldMap: Record<string, string> = {
      user_identifier: 'su.user_identifier',
      system_user_id: 'tm.system_user_id'
    };
    const sortField = sortFieldMap[pagination?.sort || ''] || 'su.user_identifier';
    const query = knex
      .table('team_member as tm')
      .select(['tm.team_member_id', 'tm.system_user_id', 'su.user_identifier', 'su.display_name', 'su.email'])
      .innerJoin('system_user as su', 'tm.system_user_id', 'su.system_user_id')
      .where('tm.team_id', teamId)
      .whereNull('tm.record_end_date')
      .orderBy(sortField, pagination?.order || 'asc');

    if (pagination) {
      query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit);
    }

    const response = await this.connection.knex(query, TeamMemberWithUser);
    return response.rows;
  }

  /**
   * Find a single team member with user details for a team and system user.
   *
   * @param {TeamMemberByUserFilter} teamMemberData - The team and system user identifiers.
   * @return {Promise<TeamMemberWithUser | null>}
   * @memberof TeamMemberRepository
   */
  async findTeamMemberWithUser(teamMemberData: TeamMemberByUserFilter): Promise<TeamMemberWithUser | null> {
    const knex = getKnex();
    const query = knex
      .table('team_member as tm')
      .select(['tm.team_member_id', 'tm.system_user_id', 'su.user_identifier', 'su.display_name', 'su.email'])
      .innerJoin('system_user as su', 'tm.system_user_id', 'su.system_user_id')
      .where('tm.team_id', teamMemberData.team_id)
      .where('tm.system_user_id', teamMemberData.system_user_id)
      .whereNull('tm.record_end_date')
      .first();

    const response = await this.connection.knex(query, TeamMemberWithUser);
    return response.rows[0] ?? null;
  }

  /**
   * Get a single active team member for a team and system user.
   *
   * @param {TeamMemberByUserFilter} teamMemberData - Team and system user identifiers.
   * @return {Promise<TeamMember | null>}
   * @memberof TeamMemberRepository
   */
  async getTeamMemberByTeamAndUser(teamMemberData: TeamMemberByUserFilter): Promise<TeamMember | null> {
    const knex = getKnex();
    const query = knex
      .table('team_member')
      .select(['team_member_id', 'system_user_id', 'team_id'])
      .where('team_id', teamMemberData.team_id)
      .where('system_user_id', teamMemberData.system_user_id)
      .whereNull('record_end_date')
      .first();

    const response = await this.connection.knex(query, TeamMember);
    return response.rows[0] ?? null;
  }

  /**
   * Get count of active team members for a given team.
   *
   * @param {string} teamId - The ID of the team.
   * @return {Promise<number>}
   * @memberof TeamMemberRepository
   */
  async getTeamMembersWithUsersCount(teamId: string): Promise<number> {
    const knex = getKnex();
    const query = knex
      .table('team_member as tm')
      .innerJoin('system_user as su', 'tm.system_user_id', 'su.system_user_id')
      .where('tm.team_id', teamId)
      .whereNull('tm.record_end_date')
      .count('* as count')
      .first();

    const response = await this.connection.knex(query);
    return Number(response.rows[0]?.count || 0);
  }
}
