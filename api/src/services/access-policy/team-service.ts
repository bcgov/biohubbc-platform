import { IDBConnection } from '../../database/db';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { TeamMemberService } from './team-member-service';
import { TeamFilters } from './team-service.interface';

/**
 * Service for managing teams.
 *
 * Note: Team members are managed by `TeamMemberService` and are not returned by this service.
 */
export class TeamService extends DBService {
  teamRepository: TeamRepository;
  teamMemberService: TeamMemberService;

  /**
   * Creates a TeamService instance.
   *
   * @param {IDBConnection} connection - The active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.teamRepository = new TeamRepository(connection);
    this.teamMemberService = new TeamMemberService(connection);
  }

  /**
   * Create a team record.
   *
   * @param {CreateTeam} teamData - Team fields required to create the team.
   * @return {Promise<Team>} The created team (includes `member_count`).
   */
  async createTeam(teamData: CreateTeam): Promise<Team> {
    const team = await this.teamRepository.insertTeam({
      name: teamData.name,
      description: teamData.description
    });

    const systemUserIds = teamData.system_user_ids ?? [];

    if (systemUserIds.length > 0) {
      await Promise.all(
        systemUserIds.map((systemUserId) =>
          this.teamMemberService.createTeamMember({
            team_id: team.team_id,
            system_user_id: systemUserId
          })
        )
      );
    }

    return this.teamRepository.getTeam(team.team_id);
  }

  /**
   * Get a single team by ID.
   *
   * @param {string} teamId - Team identifier.
   * @return {Promise<Team>} Team record including `member_count`.
   */
  getTeam(teamId: string): Promise<Team> {
    return this.teamRepository.getTeam(teamId);
  }

  /**
   * Get teams with optional search and optional pagination.
   *
   * @param {TeamFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<Team[]>} Team list response.
   */
  getTeams(filters?: TeamFilters, pagination?: ApiPaginationOptions): Promise<Team[]> {
    return this.teamRepository.getTeams(filters, pagination);
  }

  /**
   * Get total count of teams matching optional filters.
   *
   * @param {TeamFilters} [filters] - Optional filter set.
   * @return {Promise<number>} Count of matching teams.
   */
  getTeamsCount(filters?: TeamFilters): Promise<number> {
    return this.teamRepository.getTeamsCount(filters);
  }

  /**
   * Update a team record by ID.
   *
   * @param {string} teamId - Team identifier.
   * @param {UpdateTeam} teamData - Partial team fields to update.
   * @return {Promise<Team>} Updated team including current `member_count`.
   */
  async updateTeam(teamId: string, teamData: UpdateTeam): Promise<Team> {
    await this.teamRepository.updateTeam(teamId, teamData);

    // Only sync members if system_user_ids was provided in the payload
    if (teamData.system_user_ids) {
      const desiredUserIds = new Set(teamData.system_user_ids);
      const currentMembers = await this.teamMemberService.getTeamMembers(teamId);
      const currentUserIds = new Set(currentMembers.map((m) => m.system_user_id));

      // Remove members no longer in the desired list
      const toRemove = currentMembers.filter((m) => !desiredUserIds.has(m.system_user_id));
      await Promise.all(
        toRemove.map((m) =>
          this.teamMemberService.deleteTeamMemberByUser({ team_id: teamId, system_user_id: m.system_user_id })
        )
      );

      // Add members not yet on the team
      const toAdd = teamData.system_user_ids.filter((id) => !currentUserIds.has(id));
      await Promise.all(
        toAdd.map((systemUserId) =>
          this.teamMemberService.createTeamMember({ team_id: teamId, system_user_id: systemUserId })
        )
      );
    }

    return this.teamRepository.getTeam(teamId);
  }

  /**
   * Soft-delete a team by ID.
   *
   * @param {string} teamId - Team identifier.
   * @return {Promise<void>}
   */
  async deleteTeam(teamId: string): Promise<void> {
    await this.teamRepository.deleteTeam(teamId);
  }
}
