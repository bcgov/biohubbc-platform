import { IDBConnection } from '../../database/db';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { publishRefreshTeamFeatureCacheJob } from '../../queue/publisher';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { TeamPolicyFilters } from './team-policy-service.interface';

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
  async createTeamPolicy(teamPolicyData: CreateTeamPolicy): Promise<TeamPolicy> {
    const existingPolicies = await this.teamPolicyRepository.getPoliciesByTeamId(teamPolicyData.team_id, {
      policyIds: [teamPolicyData.policy_id]
    });

    if (existingPolicies.length > 0) {
      const existingPolicy = existingPolicies[0];

      // Queue cache refresh even on idempotent return — the cache may be stale
      await publishRefreshTeamFeatureCacheJob(this.connection, { teamId: teamPolicyData.team_id });

      return {
        team_policy_id: existingPolicy.team_policy_id,
        team_id: existingPolicy.team_id,
        policy_id: existingPolicy.policy_id
      };
    }

    const result = await this.teamPolicyRepository.insertTeamPolicy(teamPolicyData);

    // Queue async cache refresh so secured search results reflect the new team-policy association
    await publishRefreshTeamFeatureCacheJob(this.connection, { teamId: teamPolicyData.team_id });

    return result;
  }

  /**
   * Create team-policy records in bulk for a single team.
   *
   * @param {string} teamId - Team ID.
   * @param {string[]} policyIds - Policy IDs to associate with the team.
   * @return {Promise<TeamPolicy[]>}
   * @memberof TeamPolicyService
   */
  async createTeamPolicies(teamId: string, policyIds: string[]): Promise<TeamPolicy[]> {
    const uniquePolicyIds = [...new Set(policyIds)];

    if (!uniquePolicyIds.length) {
      return [];
    }

    const existingPolicies = await this.teamPolicyRepository.getPoliciesByTeamId(teamId, {
      policyIds: uniquePolicyIds
    });
    const existingPolicyIds = new Set(existingPolicies.map((teamPolicy) => teamPolicy.policy_id));

    const policyIdsToCreate = uniquePolicyIds.filter((policyId) => !existingPolicyIds.has(policyId));

    const result = await Promise.all(
      policyIdsToCreate.map((policyId) =>
        this.teamPolicyRepository.insertTeamPolicy({ team_id: teamId, policy_id: policyId })
      )
    );

    // Queue async cache refresh so secured search results reflect the new team-policy associations
    await publishRefreshTeamFeatureCacheJob(this.connection, { teamId });

    return result;
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
   * @return {Promise<TeamPolicyDetails[]>} - The list of team policy records.
   * @memberof TeamPolicyService
   */
  getPoliciesByTeamId(
    teamId: string,
    filters?: TeamPolicyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<TeamPolicyDetails[]> {
    return this.teamPolicyRepository.getPoliciesByTeamId(teamId, filters, pagination);
  }

  /**
   * Get all team-policy associations with team and policy names for display.
   *
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<TeamPolicyDetails[]>} - List of team policy records with names.
   * @memberof TeamPolicyService
   */
  getAllTeamPolicies(filters?: TeamPolicyFilters, pagination?: ApiPaginationOptions): Promise<TeamPolicyDetails[]> {
    return this.teamPolicyRepository.getTeamPolicies(filters, pagination);
  }

  /**
   * Get count of team-policy associations matching optional filters.
   *
   * @param {TeamPolicyFilters} [filters] - Optional filter set.
   * @return {Promise<number>}
   * @memberof TeamPolicyService
   */
  getAllTeamPoliciesCount(filters?: TeamPolicyFilters): Promise<number> {
    return this.teamPolicyRepository.getAllTeamPoliciesCount(filters);
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
   * Fetches the team_id before deleting so the team_feature cache can be
   * refreshed afterward — ensuring secured search results stay in sync
   * when a policy is removed from a team.
   *
   * @param {string} teamPolicyId - The id of the team policy to delete
   * @return {Promise<void>}
   * @memberof TeamPolicyService
   */
  async deleteTeamPolicy(teamPolicyId: string): Promise<void> {
    // Fetch team_id before the soft-delete so we know which team's cache to refresh
    const teamPolicy = await this.teamPolicyRepository.getTeamPolicy(teamPolicyId);

    await this.teamPolicyRepository.deleteTeamPolicy(teamPolicyId);

    // Queue async cache refresh so secured search results reflect the removed team-policy association
    await publishRefreshTeamFeatureCacheJob(this.connection, { teamId: teamPolicy.team_id });
  }
}
