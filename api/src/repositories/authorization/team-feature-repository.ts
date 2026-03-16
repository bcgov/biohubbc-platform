import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for managing the team_feature cache table.
 *
 * team_feature is a materialized cache — not a source of truth. It maps teams
 * to the secured submission features they can access by resolving URN wildcards
 * from policy_statement. This lets search use simple JOINs instead of per-row
 * URN matching.
 *
 * @export
 * @class TeamFeatureRepository
 * @extends {BaseRepository}
 */
export class TeamFeatureRepository extends BaseRepository {
  /**
   * Hard-delete all cached team_feature rows for a specific team.
   * Called before repopulating to ensure cache consistency during a
   * delete-and-reinsert rebuild cycle.
   *
   * @param {string} teamId - The team UUID whose cache entries to remove.
   * @return {Promise<void>}
   * @memberof TeamFeatureRepository
   */
  async deleteTeamFeaturesByTeamId(teamId: string): Promise<void> {
    const knex = getKnex();
    const query = knex.table('team_feature').where('team_id', teamId).del();

    await this.connection.knex(query);
  }

  /**
   * Populate the team_feature cache for a specific team by resolving all active
   * policy statement URNs (including wildcards) to concrete submission_feature_ids.
   *
   * Only secured features (those with an active submission_feature_security row)
   * are cached — unsecured features are already visible to everyone and don't
   * need cache entries. Uses decomposed URN columns on policy_statement
   * (urn_submission_id, urn_feature_type, urn_feature_id) for indexed matching.
   *
   * @param {string} teamId - The team UUID to populate cache for.
   * @return {Promise<void>}
   * @memberof TeamFeatureRepository
   */
  async populateTeamFeatureCache(teamId: string): Promise<void> {
    const sql = SQL`
      WITH RECURSIVE secured_features AS (
        -- Base: features with a direct security row
        SELECT sf.submission_feature_id
        FROM submission_feature sf
        JOIN submission_feature_security sfs
          ON sfs.submission_feature_id = sf.submission_feature_id
          AND sfs.record_end_date IS NULL
        WHERE sf.record_end_date IS NULL

        UNION

        -- Recursive: children inherit security from their parent
        SELECT child.submission_feature_id
        FROM submission_feature child
        INNER JOIN secured_features sec ON child.parent_submission_feature_id = sec.submission_feature_id
        WHERE child.record_end_date IS NULL
      )
      INSERT INTO team_feature (team_id, submission_feature_id)
      SELECT DISTINCT ${teamId}::uuid, sf.submission_feature_id
      FROM team_policy tp
        JOIN policy p ON p.policy_id = tp.policy_id AND p.record_end_date IS NULL
        JOIN policy_statement ps ON ps.policy_id = p.policy_id AND ps.record_end_date IS NULL
        JOIN submission_feature sf ON sf.record_end_date IS NULL
        JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
        JOIN secured_features sec ON sec.submission_feature_id = sf.submission_feature_id
      WHERE tp.team_id = ${teamId}
        AND tp.record_end_date IS NULL
        AND ps.effect = 'allow'
        AND (ps.urn_submission_id = sf.submission_id::text OR ps.urn_submission_id = '*')
        AND (ps.urn_feature_type = ft.name OR ps.urn_feature_type = '*')
        AND (ps.urn_feature_id = sf.submission_feature_id::text OR ps.urn_feature_id = '*')
      ON CONFLICT (team_id, submission_feature_id) DO NOTHING
    `;

    await this.connection.sql(sql);
  }
}
