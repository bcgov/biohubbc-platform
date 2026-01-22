import { IDBConnection } from '../../database/db';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { DBService } from '../db-service';

export class TeamPolicyService extends DBService {
  teamPolicyRepository: TeamPolicyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Create a new team policy record.
   *
   * @param {CreateTeamPolicy} teamPolicyData - Data required to create a new team policy.
   * @return {Promise<TeamPolicy>} - The created team policy record.
   * @memberof TeamPolicyService
   */
  createTeamPolicy(teamPolicyData: CreateTeamPolicy): Promise<TeamPolicy> {
    return this.teamPolicyRepository.insertTeamPolicy(teamPolicyData);
  }

  /**
   * Retrieve a team policy record
   *
   * @param {string} teamPolicyId - The ID of the team policy to fetch.
   * @return {Promise<TeamPolicy>} - The team policy record.
   * @memberof TeamPolicyService
   */
  getTeamPolicy(teamPolicyId: string): Promise<TeamPolicy> {
    return this.teamPolicyRepository.getTeamPolicy(teamPolicyId);
  }

  /**
   * Retrieve all team policy records for a specific team.
   *
   * @param {string} teamId - The ID of the team whose policies to fetch.
   * @return {Promise<TeamPolicy[]>} - The list of team policy records.
   * @memberof TeamPolicyService
   */
  getTeamPolicies(teamId: string): Promise<TeamPolicy[]> {
    return this.teamPolicyRepository.getTeamPolicies(teamId);
  }

  /**
   * Get all team-policy associations with team and policy names for display.
   *
   * @return {Promise<TeamPolicyDetails[]>} - List of team policy records with names.
   * @memberof TeamPolicyService
   */
  getAllTeamPolicies(): Promise<TeamPolicyDetails[]> {
    return this.teamPolicyRepository.getAllTeamPolicies();
  }

  /**
   * Update an existing team policy record.
   *
   * @param {string} teamPolicyId - The ID of the team policy to update.
   * @param {UpdateTeamPolicy} teamPolicyData - Partial data to update the team policy record.
   * @return {Promise<TeamPolicy>} - The updated team policy record.
   * @memberof TeamPolicyService
   */
  updateTeamPolicy(teamPolicyId: string, teamPolicyData: UpdateTeamPolicy): Promise<TeamPolicy> {
    return this.teamPolicyRepository.updateTeamPolicy(teamPolicyId, teamPolicyData);
  }

  /**
   * Delete a team policy record.
   *
   * @param {string} teamPolicyId - The id of the team policy to delete
   * @return {Promise<void>}
   * @memberof TeamPolicyService
   */
  async deleteTeamPolicy(teamPolicyId: string): Promise<void> {
    await this.teamPolicyRepository.deleteTeamPolicy(teamPolicyId);
  }
}
