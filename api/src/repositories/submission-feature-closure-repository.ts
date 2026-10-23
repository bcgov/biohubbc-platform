import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from './base-repository';
import { isSubmissionFeatureCurrent } from './sql-fragments';

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
   * {@link computeClosureForSubmission} joins both endpoints to the submission's current features), so
   * matching by source already identifies all of the submission's rows — and it matches on the primary
   * key, so no reverse index is needed. submission_feature is submission-wide (not non-ended-only), so an
   * ended feature's stale rows are swept too.
   *
   * Approval also calls this after feature activation in the same transaction, deliberately leaving
   * no committed closure slice until the asynchronous rebuild succeeds. The service pairs it with
   * {@link computeClosureForSubmission} in the rebuild transaction (delete then insert); PostgreSQL
   * MVCC makes that replacement atomic to concurrent readers and retry-idempotent.
   *
   * @param {number} submissionId The submission scope.
   * @return {Promise<void>}
   * @memberof SubmissionFeatureClosureRepository
   */
  async invalidateClosureForSubmission(submissionId: number): Promise<void> {
    await this.connection.sql(SQL`
      DELETE FROM submission_feature_closure c
      USING submission_feature sf
      WHERE sf.submission_id = ${submissionId}
        AND c.source_submission_feature_id = sf.submission_feature_id;
    `);
  }

  /**
   * Return whether any current feature of a submission lacks its reflexive closure row.
   *
   * Every current feature always has a self-loop row once a rebuild commits, so a missing self-loop means
   * the submission's closure was invalidated (approval) and its rebuild has not completed, for example
   * because the rebuild job exhausted its retries.
   *
   * @param {number} submissionId The submission scope.
   * @return {Promise<boolean>} True when at least one current feature has no self-loop closure row.
   * @memberof SubmissionFeatureClosureRepository
   */
  async hasMissingClosureForSubmission(submissionId: number): Promise<boolean> {
    const sqlStatement = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM submission_feature sf
        WHERE sf.submission_id = ${submissionId}
          AND `;
    sqlStatement.append(isSubmissionFeatureCurrent('sf'));
    sqlStatement.append(`
          AND NOT EXISTS (
            SELECT 1
            FROM submission_feature_closure c
            WHERE c.source_submission_feature_id = sf.submission_feature_id
              AND c.target_submission_feature_id = sf.submission_feature_id
          )
      ) AS has_missing_closure;
    `);

    const response = await this.connection.sql(sqlStatement, z.object({ has_missing_closure: z.boolean() }));

    return response.rows[0].has_missing_closure;
  }

  /**
   * Compute and insert the directed reachability closure for a single submission.
   *
   * Closure = reachability over the submission's parent and property (feature-reference) edges — the
   * "evidence" reach used by search. The universe is the submission's current features—published,
   * not ended, and without successors—across
   * all uploads. Stored relationship targets remain immutable feature IDs; before graph recursion,
   * distinct targets are resolved through direct successor links to their terminal current feature.
   * Content edges (submission_feature_feature) are deliberately EXCLUDED: content is the parent tree
   * reversed, so closing over (parent + content) makes every tree edge bidirectional and the closure
   * becomes the complete digraph (O(N^2)). UNION (not UNION ALL) in the recursive CTE terminates cycles
   * (property edges may cycle) and dedupes multi-path edges. is_ancestor marks the pure parent-ancestry
   * subset (the authorization reach, since security cascades up the parent tree only); auth reads WHERE
   * is_ancestor, search reads all rows. See submission_feature_closure's table comment for the full
   * rationale.
   *
   * Insert only — the service deletes the submission's prior rows first (see
   * {@link invalidateClosureForSubmission}), so this runs against an empty slice for the submission and never
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
    // Store every evidence edge (parent + property, transitive: the search reach). is_ancestor is true
    // iff the pair is also connected by a pure-parent path (the authorization reach).
    const sqlStatement = SQL`
      WITH RECURSIVE
      -- Current features in the submission (the universe for self-loops and edge filtering).
      current_features AS (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_id = ${submissionId}
          AND record_effective_date <= now()
          AND (record_end_date IS NULL OR now() < record_end_date)
          AND successor_submission_feature_id IS NULL
      ),
      -- Resolve only feature IDs referenced by current sources. The path guard prevents malformed
      -- successor cycles from hanging the rebuild; a cycle has no terminal and therefore yields no edge.
      stored_targets AS (
        SELECT DISTINCT child.parent_submission_feature_id AS original_id
        FROM submission_feature child
        JOIN current_features current_source
          ON current_source.submission_feature_id = child.submission_feature_id
        JOIN submission_feature stored_target
          ON stored_target.submission_feature_id = child.parent_submission_feature_id
         AND stored_target.submission_id = ${submissionId}
        WHERE child.parent_submission_feature_id IS NOT NULL

        UNION

        SELECT DISTINCT property.referenced_submission_feature_id AS original_id
        FROM submission_feature_property_feature property
        JOIN current_features current_source
          ON current_source.submission_feature_id = property.submission_feature_id
        JOIN submission_feature stored_target
          ON stored_target.submission_feature_id = property.referenced_submission_feature_id
         AND stored_target.submission_id = ${submissionId}
      ),
      successor_walk AS (
        SELECT original_id, original_id AS resolved_id, ARRAY[original_id]::integer[] AS path
        FROM stored_targets

        UNION ALL

        SELECT walk.original_id,
               feature.successor_submission_feature_id AS resolved_id,
               walk.path || feature.successor_submission_feature_id
        FROM successor_walk walk
        JOIN submission_feature feature
          ON feature.submission_feature_id = walk.resolved_id
         AND feature.submission_id = ${submissionId}
        WHERE feature.successor_submission_feature_id IS NOT NULL
          AND NOT feature.successor_submission_feature_id = ANY(walk.path)
      ),
      resolved_targets AS (
        SELECT walk.original_id, walk.resolved_id
        FROM successor_walk walk
        JOIN current_features current_target
          ON current_target.submission_feature_id = walk.resolved_id
      ),
      -- Direct parent and property-reference edges. Sources are current; immutable stored targets are
      -- normalized to current feature rows before entering the graph recursion. is_ancestor marks parent
      -- edges, the only edges that contribute to the authorization reach.
      direct_edges AS (
        SELECT child.submission_feature_id AS source, resolved.resolved_id AS target, true AS is_ancestor
        FROM submission_feature child
        JOIN current_features current_source
          ON current_source.submission_feature_id = child.submission_feature_id
        JOIN resolved_targets resolved
          ON resolved.original_id = child.parent_submission_feature_id
        WHERE child.parent_submission_feature_id IS NOT NULL

        UNION ALL

        SELECT property.submission_feature_id AS source, resolved.resolved_id AS target, false AS is_ancestor
        FROM submission_feature_property_feature property
        JOIN current_features current_source
          ON current_source.submission_feature_id = property.submission_feature_id
        JOIN resolved_targets resolved
          ON resolved.original_id = property.referenced_submission_feature_id
      ),
      -- One transitive walk over real edges only. A path is ancestry iff every edge on it is a parent edge,
      -- so the flag is ANDed along the path. Keeping the flag in the row lets a pair reached by both a
      -- pure-parent path and a mixed path carry both flags; UNION dedupes on (source, target, flag), which
      -- bounds the walk at two rows per pair and terminates property-reference cycles. Self-loops stay out
      -- of the recursion: as join partners they would only re-derive rows that UNION then discards.
      walk AS (
        SELECT source, target, is_ancestor FROM direct_edges
        UNION
        SELECT w.source, d.target, w.is_ancestor AND d.is_ancestor
        FROM walk w
        JOIN direct_edges d ON d.source = w.target
      ),
      -- Reflexive self-loops (every current feature reaches itself, as its own ancestor) close the reach.
      reach AS (
        SELECT source, target, is_ancestor FROM walk
        UNION ALL
        SELECT submission_feature_id, submission_feature_id, true FROM current_features
      )
      INSERT INTO submission_feature_closure (source_submission_feature_id, target_submission_feature_id, is_ancestor)
      SELECT source, target, bool_or(is_ancestor)
      FROM reach
      GROUP BY source, target;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }
}
