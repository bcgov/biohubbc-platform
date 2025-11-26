import { IDBConnection } from '../../database/db';
import { CreateTeamMember, TeamMember, UpdateTeamMember } from '../../models/team-member';
import { TeamMemberRepository } from '../../repositories/authorization/team-member-repository';
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
   * @return {Promise<TeamMember>} - The created team member record.
   * @memberof TeamMemberService
   */
  createTeamMember(teamMemberData: CreateTeamMember): Promise<TeamMember> {
    return this.teamMemberRepository.insertTeamMember(teamMemberData);
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
   * @param {string} teamMemberId - The id of the team member to delete
   * @return {Promise<void>}
   * @memberof TeamMemberService
   */
  async deleteTeamMember(teamMemberId: string): Promise<void> {
    await this.teamMemberRepository.deleteTeamMember(teamMemberId);
  }
}
