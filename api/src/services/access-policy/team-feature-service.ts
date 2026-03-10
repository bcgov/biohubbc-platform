import { IDBConnection } from '../../database/db';
import { TeamFeatureRepository } from '../../repositories/authorization/team-feature-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { DBService } from '../db-service';

/**
 * Service for managing the team_feature cache.
 *
 * team_feature is a materialized cache that maps teams to the secured
 * submission features they can access. It can always be fully rebuilt from
 * team_policy → policy_statement → submission_feature URN matching.
 * The delete-and-reinsert pattern ensures consistency.
 *
 * @export
 * @class TeamFeatureService
 * @extends {DBService}
 */
export class TeamFeatureService extends DBService {
  teamFeatureRepository: TeamFeatureRepository;
  teamPolicyRepository: TeamPolicyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamFeatureRepository = new TeamFeatureRepository(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Refresh the team_feature cache for a specific team.
   *
   * Deletes existing cache entries and repopulates from current policy
   * statements. Cache resolves URN wildcards to concrete submission_feature_ids
   * for fast search JOINs instead of per-row URN matching.
   *
   * @param {string} teamId - The team UUID to refresh cache for.
   * @return {Promise<void>}
   * @memberof TeamFeatureService
   */
  async refreshCacheForTeam(teamId: string): Promise<void> {
    await this.teamFeatureRepository.deleteTeamFeaturesByTeamId(teamId);
    await this.teamFeatureRepository.populateTeamFeatureCache(teamId);
  }

  /**
   * Refresh the team_feature cache for all teams that have a specific policy.
   * Called after policy create/update/delete to keep cache in sync with
   * policy changes.
   *
   * @param {string} policyId - The policy UUID whose teams need cache refresh.
   * @return {Promise<void>}
   * @memberof TeamFeatureService
   */
  async refreshCacheForPolicy(policyId: string): Promise<void> {
    const teamIds = await this.getTeamIdsForPolicy(policyId);

    for (const teamId of teamIds) {
      await this.refreshCacheForTeam(teamId);
    }
  }

  /**
   * Get all team_ids that have a specific policy assigned (via team_policy).
   * Used to determine which teams need cache refresh after a policy mutation.
   *
   * @param {string} policyId - The policy UUID to look up.
   * @return {Promise<string[]>} - Array of team UUIDs.
   * @memberof TeamFeatureService
   */
  async getTeamIdsForPolicy(policyId: string): Promise<string[]> {
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });

    return teamPolicies.map((tp) => tp.team_id);
  }
}
