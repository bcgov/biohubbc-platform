import { IDBConnection } from '../../database/db';
import { CreateTeam, Team, UpdateTeam } from '../../models/team';
import { TeamRepository } from '../../repositories/authorization/team-repository';
import { DBService } from '../db-service';

export class TeamService extends DBService {
  teamRepository: TeamRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamRepository = new TeamRepository(connection);
  }

  /**
   * Create a new team record in the database.
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
}
