import { getKnex, IDBConnection } from '../../database/db';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
import { TeamMemberRepository } from '../../repositories/authorization/team-member-repository';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { DBService } from '../db-service';

/**
 * A team member with user details.
 */
export interface ITeamMemberWithUser {
  team_member_id: string;
  system_user_id: number;
  user_identifier: string;
}

/**
 * A team with its members.
 */
export interface ITeamWithMembers extends Team {
  members: ITeamMemberWithUser[];
}

export class TeamService extends DBService {
  teamRepository: TeamRepository;
  teamMemberRepository: TeamMemberRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamRepository = new TeamRepository(connection);
    this.teamMemberRepository = new TeamMemberRepository(connection);
  }

  /**
   * Create a new team record.
   *
   * @param {CreateTeam} teamData - Data required to create a new team.
   * @return {Promise<Team>} - The created team record.
   * @memberof TeamService
   */
  createTeam(teamData: CreateTeam): Promise<Team> {
    return this.teamRepository.insertTeam(teamData);
  }

  /**
   * Retrieve a team record
   *
   * @param {string} teamId - The ID of the team to fetch.
   * @return {Promise<Team>} - The team record.
   * @memberof TeamService
   */
  getTeam(teamId: string): Promise<Team> {
    return this.teamRepository.getTeam(teamId);
  }

  /**
   * Retrieve multiple team records
   *
   * @return {Promise<Team[]>} - The team records.
   * @memberof TeamService
   */
  getTeams(): Promise<Team[]> {
    return this.teamRepository.getTeams();
  }

  /**
   * Update an existing team record.
   *
   * @param {string} teamId - The ID of the team to update.
   * @param {UpdateTeam} teamData - Partial data to update the team record.
   * @return {Promise<Team>} - The updated team record.
   * @memberof TeamService
   */
  updateTeam(teamId: string, teamData: UpdateTeam): Promise<Team> {
    return this.teamRepository.updateTeam(teamId, teamData);
  }

  /**
   * Delete a team record.
   *
   * @param {string} teamId - The id of the team to delete
   * @return {Promise<void>}
   * @memberof TeamService
   */
  async deleteTeam(teamId: string): Promise<void> {
    await this.teamRepository.deleteTeam(teamId);
  }

  /**
   * Get all teams with their members, with pagination and search.
   *
   * @param {object} options - Pagination and search options.
   * @param {number} options.page - Page number (0-indexed).
   * @param {number} options.limit - Number of items per page.
   * @param {string} [options.search] - Optional search term to filter by team name.
   * @return {Promise<{ teams: ITeamWithMembers[]; pagination: { total: number; page: number; limit: number } }>}
   * @memberof TeamService
   */
  async getTeamsWithMembers(options: { page: number; limit: number; search?: string }): Promise<{
    teams: ITeamWithMembers[];
    pagination: { total: number; page: number; limit: number };
  }> {
    const { teams, total } = await this.teamRepository.getTeamsWithPagination(options);

    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => ({
        ...team,
        members: await this.getTeamMembersWithUsers(team.team_id)
      }))
    );

    return {
      teams: teamsWithMembers,
      pagination: { total, page: options.page, limit: options.limit }
    };
  }

  /**
   * Get a single team with its members.
   *
   * @param {string} teamId - The ID of the team to fetch.
   * @return {Promise<ITeamWithMembers>}
   * @memberof TeamService
   */
  async getTeamWithMembers(teamId: string): Promise<ITeamWithMembers> {
    const team = await this.teamRepository.getTeam(teamId);
    const members = await this.getTeamMembersWithUsers(teamId);
    return { ...team, members };
  }

  /**
   * Get team members with user details.
   *
   * @param {string} teamId - The ID of the team.
   * @return {Promise<ITeamMemberWithUser[]>}
   * @memberof TeamService
   */
  async getTeamMembersWithUsers(teamId: string): Promise<ITeamMemberWithUser[]> {
    const knex = getKnex();
    const query = knex
      .table('team_member as tm')
      .select(['tm.team_member_id', 'tm.system_user_id', 'su.user_identifier'])
      .innerJoin('system_user as su', 'tm.system_user_id', 'su.system_user_id')
      .where('tm.team_id', teamId)
      .whereNull('tm.record_end_date')
      .orderBy('su.user_identifier', 'asc');

    const response = await this.connection.knex(query);
    return response.rows;
  }

  /**
   * Create a team with members.
   *
   * @param {CreateTeam} teamData - Data required to create a new team.
   * @param {number[]} memberUserIds - System user IDs to add as members.
   * @return {Promise<ITeamWithMembers>}
   * @memberof TeamService
   */
  async createTeamWithMembers(teamData: CreateTeam, memberUserIds: number[]): Promise<ITeamWithMembers> {
    const team = await this.createTeam(teamData);

    // Add members
    await Promise.all(
      memberUserIds.map((userId) =>
        this.teamMemberRepository.insertTeamMember({
          team_id: team.team_id,
          system_user_id: userId
        })
      )
    );

    const members = await this.getTeamMembersWithUsers(team.team_id);
    return { ...team, members };
  }

  /**
   * Update a team and sync its members.
   * Strategy: Compare new member list with existing, add new, remove old.
   *
   * @param {string} teamId - The ID of the team to update.
   * @param {UpdateTeam} teamData - Partial data to update the team record.
   * @param {number[]} memberUserIds - New complete member list (user IDs).
   * @return {Promise<ITeamWithMembers>}
   * @memberof TeamService
   */
  async updateTeamWithMembers(teamId: string, teamData: UpdateTeam, memberUserIds: number[]): Promise<ITeamWithMembers> {
    const team = await this.updateTeam(teamId, teamData);

    // Get current members
    const currentMembers = await this.teamMemberRepository.getTeamMembersByTeamId(teamId);
    const currentUserIds = new Set(currentMembers.map((m) => m.system_user_id));
    const newUserIds = new Set(memberUserIds);

    // Find members to add (in new list but not current)
    const toAdd = memberUserIds.filter((id) => !currentUserIds.has(id));

    // Find members to remove (in current but not new list)
    const toRemove = currentMembers.filter((m) => !newUserIds.has(m.system_user_id));

    // Add new members and soft-delete removed members in parallel
    await Promise.all([
      ...toAdd.map((userId) =>
        this.teamMemberRepository.insertTeamMember({
          team_id: teamId,
          system_user_id: userId
        })
      ),
      ...toRemove.map((member) => this.teamMemberRepository.deleteTeamMember(member.team_member_id))
    ]);

    const members = await this.getTeamMembersWithUsers(teamId);
    return { ...team, members };
  }
}
