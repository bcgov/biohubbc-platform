import { IDBConnection } from '../../database/db';
import { CreateTeamPolicy, TeamPolicy, TeamPolicyDetails, UpdateTeamPolicy } from '../../models/team-policy';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { SecurityScopeService } from './security-scope-service';
import { TeamPolicyFilters } from './team-policy-service.interface';

export class TeamPolicyService extends DBService {
  teamPolicyRepository: TeamPolicyRepository;
  securityScopeService: SecurityScopeService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
    this.securityScopeService = new SecurityScopeService(connection);
  }

  /**
   * Create a team policy record and materialize the access cache for the pair.
   *
   * Inserting a `team_policy` link is the trigger that lazily builds the
   * normalized scope cache (`security_scope`, `team_security_scope`) for the
   * team. The materialization runs via
   * `SecurityScopeService.materializePolicyStatementScopes` followed by
   * `grantTeamAccessForPolicy`. The first call short-circuits when the policy
   * is not `status='approved'` or has no `ALLOW` statements — so unapproved or
   * empty policies create the link without granting any access.
   *
   * If the (team, policy) link already exists, returns the existing record
   * without re-materializing.
   *
   * @param {CreateTeamPolicy} teamPolicyData - Data required to create a new team policy.
   * @return {Promise<TeamPolicy>} - The created (or pre-existing) team policy record.
   * @memberof TeamPolicyService
   */
  async createTeamPolicy(teamPolicyData: CreateTeamPolicy): Promise<TeamPolicy> {
    const existingPolicies = await this.teamPolicyRepository.getPoliciesByTeamId(teamPolicyData.team_id, {
      policyIds: [teamPolicyData.policy_id]
    });

    if (existingPolicies.length > 0) {
      const existingPolicy = existingPolicies[0];
      return {
        team_policy_id: existingPolicy.team_policy_id,
        team_id: existingPolicy.team_id,
        policy_id: existingPolicy.policy_id,
        record_end_date: existingPolicy.record_end_date
      };
    }

    const teamPolicy = await this.teamPolicyRepository.insertTeamPolicy(teamPolicyData);

    // Materialize the access cache for this (team, policy) pair: statement scopes
    // (shared across teams) first, then the team's access rows that point at them.
    // Skip the team-grant insert when there's nothing to grant.
    const materialized = await this.securityScopeService.materializePolicyStatementScopes(teamPolicyData.policy_id);
    if (materialized) {
      await this.securityScopeService.grantTeamAccessForPolicy(teamPolicyData.team_id, teamPolicyData.policy_id);
    }

    return teamPolicy;
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

    const createdTeamPolicies = await Promise.all(
      policyIdsToCreate.map((policyId) =>
        this.teamPolicyRepository.insertTeamPolicy({ team_id: teamId, policy_id: policyId })
      )
    );

    // Materialize the access cache for newly created team-policy associations.
    // Pre-existing policies already had their cache rows materialized on first creation.
    for (const policyId of policyIdsToCreate) {
      const materialized = await this.securityScopeService.materializePolicyStatementScopes(policyId);
      if (materialized) {
        await this.securityScopeService.grantTeamAccessForPolicy(teamId, policyId);
      }
    }

    return createdTeamPolicies;
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
   * Get teams associated with a policy.
   *
   * @param {string} policyId - Policy ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options.
   * @return {Promise<TeamPolicyDetails[]>}
   * @memberof TeamPolicyService
   */
  getTeamsByPolicyId(policyId: string, pagination?: ApiPaginationOptions): Promise<TeamPolicyDetails[]> {
    return this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] }, pagination);
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
   * Get count of teams associated with a policy.
   *
   * @param {string} policyId - Policy ID.
   * @return {Promise<number>}
   * @memberof TeamPolicyService
   */
  getTeamsByPolicyIdCount(policyId: string): Promise<number> {
    return this.teamPolicyRepository.getAllTeamPoliciesCount({ policyIds: [policyId] });
  }

  /**
   * Update a team policy and rebuild the team's security scope grants if active state changes.
   *
   * The only mutable team-policy field is currently `record_end_date`. Changing
   * it can add or remove a policy from the active chain, so the derived
   * `team_security_scope` cache only needs a rebuild when this update moves the
   * link into or out of that active chain.
   *
   * @param {string} teamPolicyId - The ID of the team policy to update.
   * @param {UpdateTeamPolicy} teamPolicyData - Partial data to update the team policy record.
   * @return {Promise<TeamPolicy>} - The updated team policy record.
   * @memberof TeamPolicyService
   */
  async updateTeamPolicy(teamPolicyId: string, teamPolicyData: UpdateTeamPolicy): Promise<TeamPolicy> {
    const existingTeamPolicy = await this.teamPolicyRepository.getTeamPolicy(teamPolicyId);

    if (teamPolicyData.record_end_date === undefined) {
      return existingTeamPolicy;
    }

    const updatedTeamPolicy = await this.teamPolicyRepository.updateTeamPolicy(teamPolicyId, teamPolicyData);

    const wasActive = existingTeamPolicy.record_end_date === null;
    const isActive = updatedTeamPolicy.record_end_date === null;

    if (wasActive !== isActive) {
      await this.securityScopeService.rebuildTeamSecurityScopes(existingTeamPolicy.team_id);
    }

    return updatedTeamPolicy;
  }

  /**
   * Delete a team policy and rebuild the team's security scope grants.
   *
   * Fetches the team_id before soft-deleting, because the rebuild needs to
   * re-derive scopes from the remaining active policy chain for that team.
   *
   * @param {string} teamPolicyId - The id of the team policy to delete
   * @return {Promise<void>}
   * @memberof TeamPolicyService
   */
  async deleteTeamPolicy(teamPolicyId: string): Promise<void> {
    const teamPolicy = await this.teamPolicyRepository.getTeamPolicy(teamPolicyId);

    await this.teamPolicyRepository.deleteTeamPolicy(teamPolicyId);

    // Rebuild the team's scope grants from the remaining active policy chain
    await this.securityScopeService.rebuildTeamSecurityScopes(teamPolicy.team_id);
  }
}
