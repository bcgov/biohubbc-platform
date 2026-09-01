import SQL from 'sql-template-strings';
import { BaseRepository } from './base-repository';

/**
 * Repository class for the derived submission feature closure table.
 *
 * @export
 * @class SubmissionFeatureClosureRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureClosureRepository extends BaseRepository {
  /**
   * Delete the closure rows for a single submission.
   *
   * Scoped by source: every closure row has BOTH endpoints in one submission (the edge CTEs in
   * {@link computeClosureForSubmission} joins both endpoints to the submission's active features), so
   * matching by source already identifies all of the submission's rows — and it matches on the primary
   * key, so no reverse index is needed. submission_feature is submission-wide (not non-ended-only), so an
   * ended feature's stale rows are swept too.
   *
   * The service pairs this with {@link computeClosureForSubmission} in one transaction (delete then
   * insert); that ordering is what makes the wholesale recompute idempotent under retry.
   *
   * @param {number} submissionId The submission scope.
   * @return {Promise<void>}
   * @memberof SubmissionFeatureClosureRepository
   */
  async deleteClosureForSubmission(submissionId: number): Promise<void> {
    await this.connection.sql(SQL`
      DELETE FROM submission_feature_closure c
      USING submission_feature sf
      WHERE sf.submission_id = ${submissionId}
        AND c.source_submission_feature_id = sf.submission_feature_id;
    `);
  }

  /**
   * Compute and insert the directed reachability closure for a single submission.
   *
   * Closure = reachability over the submission's parent and property (feature-reference) edges — the
   * "evidence" reach used by search. The universe is the submission's active rows across all uploads,
   * determined only by the effective and end dates on `submission_feature`.
   * Content edges (submission_feature_feature) are deliberately EXCLUDED: content is the parent tree
   * reversed, so closing over (parent + content) makes every tree edge bidirectional and the closure
   * becomes the complete digraph (O(N^2)). UNION (not UNION ALL) in the recursive CTEs terminates cycles
   * (property edges may cycle) and dedupes multi-path edges. is_ancestor marks the pure parent-ancestry
   * subset (the authorization reach, since security cascades up the parent tree only); auth reads WHERE
   * is_ancestor, search reads all rows. See submission_feature_closure's table comment for the full
   * rationale.
   *
   * Insert only — the service deletes the submission's prior rows first (see
   * {@link deleteClosureForSubmission}), so this runs against an empty slice for the submission and never
   * accumulates duplicates.
   *
   * Returns the number of closure rows written. A submission whose features are all ended legitimately
   * writes zero rows, so a count of 0 is a valid result, not a failure.
   *
   * @param {number} submissionId The submission scope.
   * @return {Promise<number>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureRepository
   */
  async computeClosureForSubmission(submissionId: number): Promise<number> {
    // Compute TWO closures and store every evidence edge: the ancestry closure (parent-only,
    // transitive) is the authorization reach; the evidence closure (parent + property, transitive) is
    // the search reach and a superset. is_ancestor is true iff the edge is also in the ancestry closure.
    const sqlStatement = SQL`
      WITH RECURSIVE
      -- Active features in the submission (the universe for self-loops and edge filtering).
      active_features AS (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_id = ${submissionId}
          AND record_effective_date <= now()
          AND (record_end_date IS NULL OR now() < record_end_date)
      ),
      -- Reflexive self-loops (every active feature reaches itself) seed the closure.
      self_loops AS (
        SELECT submission_feature_id AS source, submission_feature_id AS target FROM active_features
      ),
      -- Direct parent and property-reference edges. Both stored endpoints must be active.
      parent_edges AS (
        SELECT child.submission_feature_id AS source, child.parent_submission_feature_id AS target
        FROM submission_feature child
        JOIN active_features active_source
          ON active_source.submission_feature_id = child.submission_feature_id
        JOIN active_features active_target
          ON active_target.submission_feature_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL
      ),
      property_edges AS (
        SELECT property.submission_feature_id AS source,
               property.referenced_submission_feature_id AS target
        FROM submission_feature_property_feature property
        JOIN active_features active_source
          ON active_source.submission_feature_id = property.submission_feature_id
        JOIN active_features active_target
          ON active_target.submission_feature_id = property.referenced_submission_feature_id
      ),
      -- Ancestry base: self + parent only (the authorization reach, before transitive closure).
      ancestry_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
      ),
      -- Evidence base: self + parent + property (the search reach). UNION ALL because dedupe happens in
      -- the recursive CTEs below.
      direct_edges AS (
        SELECT source, target FROM self_loops
        UNION ALL SELECT source, target FROM parent_edges
        UNION ALL SELECT source, target FROM property_edges
      ),
      -- Ancestry closure: transitive reachability over parent only. Acyclic up-tree, so it terminates at
      -- tree depth. These edges are the authorization reach (flagged is_ancestor = true below).
      ancestry_closure AS (
        SELECT source, target FROM ancestry_edges
        UNION
        SELECT c.source, d.target
        FROM ancestry_closure c
        JOIN ancestry_edges d ON d.source = c.target
      ),
      -- Evidence closure: transitive reachability over parent + property (the search reach; a superset of
      -- the ancestry closure). UNION (not UNION ALL) dedupes multi-path edges and terminates on cycles in
      -- the property-reference graph (submission_feature_property_feature is not cycle-prevented).
      closure AS (
        SELECT source, target FROM direct_edges
        UNION
        SELECT c.source, d.target
        FROM closure c
        JOIN direct_edges d ON d.source = c.target
      )
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      SELECT cl.source, cl.target, (anc.source IS NOT NULL) AS is_ancestor
      FROM closure cl
      LEFT JOIN ancestry_closure anc
        ON anc.source = cl.source AND anc.target = cl.target;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }
}
