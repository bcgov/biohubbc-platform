import { IDBConnection } from '../../database/db';
import { TeamFeatureRepository } from '../../repositories/authorization/team-feature-repository';
import { DBService } from '../db-service';

/**
 * Service for managing the team_feature cache.
 *
 * team_feature is a materialized cache that maps teams to the secured
 * submission features they can access. It can always be fully rebuilt from
 * team_policy → policy_statement → submission_feature URN matching.
 * The delete-and-reinsert pattern ensures consistency.
 *
 * Callers should not invoke this service directly from HTTP request handlers.
 * Policy/team-policy mutations publish a queue job instead, so the potentially
 * large cache rebuild runs outside the request path. The job handler calls
 * refreshCacheForTeam via this service.
 *
 * @export
 * @class TeamFeatureService
 * @extends {DBService}
 */
export class TeamFeatureService extends DBService {
  teamFeatureRepository: TeamFeatureRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.teamFeatureRepository = new TeamFeatureRepository(connection);
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
}
