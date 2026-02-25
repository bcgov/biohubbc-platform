import { IDBConnection } from '../../database/db';
import {
  CreateTeamMember,
  TeamMember,
  TeamMemberByUserFilter,
  TeamMemberWithUser,
  UpdateTeamMember
} from '../../models/team-member';
import { TeamMemberRepository } from '../../repositories/authorization/team-member-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';

export class TeamMemberService extends DBService {
  teamMemberRepository: TeamMemberRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamMemberRepository = new TeamMemberRepository(connection);
  }

  /**
   * Create a new team member record.
   *
   * @param {CreateTeamMember} teamMemberData - Data required to create a new team member.
   * @return {Promise<TeamMemberWithUser>} - The created team member with user details, or existing record if associated.
   * @memberof TeamMemberService
   */
  async createTeamMember(teamMemberData: CreateTeamMember): Promise<TeamMemberWithUser> {
    const existing = await this.teamMemberRepository.getTeamMemberWithUser(teamMemberData);

    if (existing) {
      return existing;
    }

    await this.teamMemberRepository.insertTeamMember(teamMemberData);

    const created = await this.teamMemberRepository.getTeamMemberWithUser(teamMemberData);

    if (!created) {
      throw new Error('Failed to create team member');
    }

    return created;
  }

  /**
   * Retrieve a team member record
   *
   * @param {string} teamMemberId - The ID of the team member to fetch.
   * @return {Promise<TeamMember>} - The team member record.
   * @memberof TeamMemberService
   */
  getTeamMember(teamMemberId: string): Promise<TeamMember> {
    return this.teamMemberRepository.getTeamMember(teamMemberId);
  }

  /**
   * Retrieve all team members for a given team
   *
   * @param {string} teamId - The ID of the team to fetch members for.
   * @return {Promise<TeamMember[]>} - The list of team members for the team.
   * @memberof TeamMemberService
   */
  getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return this.teamMemberRepository.getTeamMembersByTeamId(teamId);
  }

  /**
   * Update an existing team member record.
   *
   * @param {string} teamMemberId - The ID of the team member to update.
   * @param {UpdateTeamMember} teamMemberData - Partial data to update the team member record.
   * @return {Promise<TeamMember>} - The updated team member record.
   * @memberof TeamMemberService
   */
  updateTeamMember(teamMemberId: string, teamMemberData: UpdateTeamMember): Promise<TeamMember> {
    return this.teamMemberRepository.updateTeamMember(teamMemberId, teamMemberData);
  }

  /**
   * Delete a team member record.
   *
   * @param {string} teamMemberId - Team member ID.
   * @return {Promise<void>}
   * @memberof TeamMemberService
   */
  async deleteTeamMember(teamMemberId: string): Promise<void> {
    await this.teamMemberRepository.deleteTeamMember(teamMemberId);
  }

  /**
   * Delete a team member association by team and system user IDs.
   *
   * @param {TeamMemberByUserFilter} teamMemberData - Team and user identifiers.
   * @return {Promise<void>}
   * @memberof TeamMemberService
   */
  async deleteTeamMemberByUser(teamMemberData: TeamMemberByUserFilter): Promise<void> {
    const existing = await this.teamMemberRepository.getTeamMemberByTeamAndUser(teamMemberData);

    if (!existing) {
      return;
    }

    await this.teamMemberRepository.deleteTeamMember(existing.team_member_id);
  }

  /**
   * Retrieve team members with user details for a given team.
   *
   * @param {string} teamId - The ID of the team to fetch members for.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<TeamMemberWithUser[]>}
   * @memberof TeamMemberService
   */
  getTeamMembersWithUsers(teamId: string, pagination?: ApiPaginationOptions): Promise<TeamMemberWithUser[]> {
    return this.teamMemberRepository.getTeamMembersWithUsers(teamId, pagination);
  }

  /**
   * Retrieve count of team members with user details for a given team.
   *
   * @param {string} teamId - The ID of the team to fetch member count for.
   * @return {Promise<number>}
   * @memberof TeamMemberService
   */
  getTeamMembersWithUsersCount(teamId: string): Promise<number> {
    return this.teamMemberRepository.getTeamMembersWithUsersCount(teamId);
  }
}
