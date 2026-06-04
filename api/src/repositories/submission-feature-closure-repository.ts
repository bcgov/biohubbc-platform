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
   * Delete the closure rows for a single upload.
   *
   * Scoped by source: every closure row has BOTH endpoints in one upload (the edge CTEs in
   * {@link computeClosureForUpload} join af_src AND af_tgt to the upload's active features), so matching
   * by source already identifies all of the upload's rows — and it matches on the primary key, so no
   * reverse index is needed. submission_feature is upload-wide (not active-only), so a deactivated
   * feature's stale rows are swept too.
   *
   * The service pairs this with {@link computeClosureForUpload} in one transaction (delete then insert);
   * that ordering is what makes the wholesale recompute idempotent under retry.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @return {Promise<void>}
   * @memberof SubmissionFeatureClosureRepository
   */
  async deleteClosureForUpload(submissionUploadId: string): Promise<void> {
    await this.connection.sql(SQL`
      DELETE FROM submission_feature_closure c
      USING submission_feature sf
      WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
        AND c.source_submission_feature_id = sf.submission_feature_id;
    `);
  }

  /**
   * Compute and insert the directed reachability closure for a single upload.
   *
   * Closure = reachability over an upload's parent and property (feature-reference) edges — the
   * "evidence" reach used by search. Content edges (submission_feature_feature) are deliberately
   * EXCLUDED: content is the parent tree reversed, so closing over (parent + content) makes every tree
   * edge bidirectional and the closure becomes the complete same-upload digraph (O(N^2)). UNION (not
   * UNION ALL) in the recursive CTEs terminates cycles (property edges may cycle) and dedupes
   * multi-path edges. is_ancestor marks the pure parent-ancestry subset (the authorization reach, since
   * security cascades up the parent tree only); auth reads WHERE is_ancestor, search reads all rows.
   * See submission_feature_closure's table comment for the full rationale.
   *
   * Insert only — the service deletes the upload's prior rows first (see {@link deleteClosureForUpload}),
   * so this runs against an empty slice for the upload and never accumulates duplicates.
   *
   * Returns the number of closure rows written. An upload whose features are all inactive legitimately
   * writes zero rows, so a count of 0 is a valid result, not a failure.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @return {Promise<number>} The number of closure rows written.
   * @memberof SubmissionFeatureClosureRepository
   */
  async computeClosureForUpload(submissionUploadId: string): Promise<number> {
    // Compute TWO closures and store every evidence edge: the ancestry closure (parent-only,
    // transitive) is the authorization reach; the evidence closure (parent + property, transitive) is
    // the search reach and a superset. is_ancestor is true iff the edge is also in the ancestry closure.
    const response = await this.connection.sql(SQL`
      WITH RECURSIVE
      -- Active features in the upload (the universe for self-loops and the join filter).
      active_features AS (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_end_date IS NULL
      ),
      -- Reflexive self-loops (every active feature reaches itself) — the reflexive edges that seed the closure.
      self_loops AS (
        SELECT submission_feature_id AS source, submission_feature_id AS target FROM active_features
      ),
      -- Direct edges — parent (child -> parent, "up") / property (feature reference) — each filtered so
      -- BOTH endpoints are intra-upload active features. Content edges are intentionally NOT included.
      parent_edges AS (
        SELECT child.submission_feature_id AS source, child.parent_submission_feature_id AS target
        FROM submission_feature child
        JOIN active_features af_src ON af_src.submission_feature_id = child.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL
      ),
      property_edges AS (
        SELECT pf.submission_feature_id AS source, pf.referenced_submission_feature_id AS target
        FROM submission_feature_property_feature pf
        JOIN active_features af_src ON af_src.submission_feature_id = pf.submission_feature_id
        JOIN active_features af_tgt ON af_tgt.submission_feature_id = pf.referenced_submission_feature_id
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
    `);

    return response.rowCount ?? 0;
  }
}
