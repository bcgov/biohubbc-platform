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
   * Get submission IDs that contain secured features matching a team's policy
   * grants. Used to partition the cache rebuild into per-submission batches
   * so each recursive walk stays small.
   *
   * @param {string} teamId - The team UUID to resolve grants for.
   * @return {Promise<number[]>} Submission IDs with secured features the team may access.
   * @memberof TeamFeatureRepository
   */
  async getSecuredSubmissionIds(teamId: string): Promise<number[]> {
    const sql = SQL`
      SELECT DISTINCT sf.submission_id
      FROM submission_feature sf
        JOIN submission_feature_security sfs
          ON sfs.submission_feature_id = sf.submission_feature_id
          AND sfs.record_end_date IS NULL
      WHERE sf.record_end_date IS NULL
        AND EXISTS (
          SELECT 1
          FROM team_policy tp
            JOIN policy p ON p.policy_id = tp.policy_id AND p.record_end_date IS NULL
            JOIN policy_statement ps ON ps.policy_id = p.policy_id AND ps.record_end_date IS NULL
          WHERE tp.team_id = ${teamId}
            AND tp.record_end_date IS NULL
            AND ps.effect = 'allow'
            AND (ps.urn_submission_id = sf.submission_id::text OR ps.urn_submission_id = '*')
        )
    `;

    const response = await this.connection.sql(sql);
    return response.rows.map((row: { submission_id: number }) => row.submission_id);
  }

  /**
   * Populate the team_feature cache for a batch of submissions.
   *
   * Runs the recursive secured-feature walk scoped to the given submission IDs,
   * so each invocation only materializes a bounded subset of the feature tree.
   * The full URN check (submission, feature_type, feature_id) runs at the end
   * to filter down to features the team's policy actually grants.
   *
   * Cannot pre-filter by feature_type or feature_id at the recursion base
   * because children may have different types than their secured ancestor.
   *
   * @param {string} teamId - The team UUID to populate cache for.
   * @param {number[]} submissionIds - Submission IDs to scope the recursive walk to.
   * @return {Promise<void>}
   * @memberof TeamFeatureRepository
   */
  async populateTeamFeatureCacheBatch(teamId: string, submissionIds: number[]): Promise<void> {
    const sql = SQL`
      WITH RECURSIVE
      team_grants AS (
        SELECT ps.urn_submission_id, ps.urn_feature_type, ps.urn_feature_id
        FROM team_policy tp
          JOIN policy p ON p.policy_id = tp.policy_id AND p.record_end_date IS NULL
          JOIN policy_statement ps ON ps.policy_id = p.policy_id AND ps.record_end_date IS NULL
        WHERE tp.team_id = ${teamId}
          AND tp.record_end_date IS NULL
          AND ps.effect = 'allow'
      ),
      -- Recursive CTE: walk secured subtrees within this batch of submissions
      secured_features AS (
        SELECT sf.submission_feature_id
        FROM submission_feature sf
          JOIN submission_feature_security sfs
            ON sfs.submission_feature_id = sf.submission_feature_id
            AND sfs.record_end_date IS NULL
        WHERE sf.record_end_date IS NULL
          AND sf.submission_id = ANY(${submissionIds})

        UNION

        SELECT child.submission_feature_id
        FROM submission_feature child
          JOIN secured_features sec ON child.parent_submission_feature_id = sec.submission_feature_id
        WHERE child.record_end_date IS NULL
      )
      -- Final: insert only features that pass the full URN policy check
      INSERT INTO team_feature (team_id, submission_feature_id)
      SELECT ${teamId}::uuid, st.submission_feature_id
      FROM secured_features st
        JOIN submission_feature sf ON sf.submission_feature_id = st.submission_feature_id
        JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE EXISTS (
        SELECT 1 FROM team_grants tg
        WHERE (tg.urn_submission_id = sf.submission_id::text OR tg.urn_submission_id = '*')
          AND (tg.urn_feature_type = ft.name OR tg.urn_feature_type = '*')
          AND (tg.urn_feature_id = sf.submission_feature_id::text OR tg.urn_feature_id = '*')
      )
    `;

    await this.connection.sql(sql);
  }
}
