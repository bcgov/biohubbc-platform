import SQL from 'sql-template-strings';
import { SECURITY_SCOPE_ANCHOR_BATCH_SIZE } from '../../constants/security';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { PolicyEffect } from '../../models/policy-statement';
import { SecurityScope, SecurityScopeId } from '../../models/security-scope';
import { AnchorBatchResult, SecurityScopeUrn } from '../../services/access-policy/security-scope-service.interface';
import { BaseRepository } from '../base-repository';
import { isEffectivelySecured, isSubmissionFeatureCurrent } from '../sql-fragments';

/**
 * SQL text standing for the three components of a scope URN: positional placeholders (`'$2'`) or
 * column references. Trusted text only, never user input.
 */
interface ScopeUrnSql {
  submissionId: string;
  featureType: string;
  featureId: string;
}

/**
 * Predicate for a feature that prunes a scope-anchor candidate below it: it matches the scope URN
 * and is effectively secured.
 *
 * Feature lifecycle and the closure self-loop are deliberately not checked. A candidate is pruned by
 * any URN-matching, effectively-secured proper ancestor in the closure snapshot, current or not.
 *
 * The result is an AND-joined list for use inside a WHERE or ON clause's AND chain.
 *
 * @param featureAlias SQL alias for submission_feature.
 * @param featureTypeAlias SQL alias for the feature's feature_type row.
 * @param urn SQL text for the scope URN components.
 * @returns SQL predicate; its only placeholders are the ones passed in `urn`.
 */
function scopeAnchorAncestorPredicate(featureAlias: string, featureTypeAlias: string, urn: ScopeUrnSql): string {
  const featureIdColumn = `${featureAlias}.submission_feature_id`;

  return `(${urn.submissionId} = ${featureAlias}.submission_id::text OR ${urn.submissionId} = '*')
           AND (${urn.featureType} = ${featureTypeAlias}.name OR ${urn.featureType} = '*')
           AND (${urn.featureId} = ${featureIdColumn}::text OR ${urn.featureId} = '*')
           AND ${isEffectivelySecured(featureIdColumn)}`;
}

/**
 * Predicate for a scope-anchor candidate: a current feature with a closure self-loop that matches
 * the scope URN and is effectively secured.
 *
 * `isEffectivelySecured` deliberately fails closed when closure is missing, so cache writers require
 * the self-loop as positive evidence that the derived graph is available before they store anything.
 *
 * A candidate is an anchor when no proper ancestor satisfies {@link scopeAnchorAncestorPredicate}.
 * The anchor batch and the feature bitmap build share both predicates so the two cannot drift.
 *
 * The result is an AND-joined list for use inside a WHERE or ON clause's AND chain.
 *
 * @param featureAlias SQL alias for submission_feature.
 * @param featureTypeAlias SQL alias for the feature's feature_type row.
 * @param urn SQL text for the scope URN components.
 * @returns SQL predicate; its only placeholders are the ones passed in `urn`.
 */
function scopeAnchorCandidatePredicate(featureAlias: string, featureTypeAlias: string, urn: ScopeUrnSql): string {
  return `${isSubmissionFeatureCurrent(featureAlias)}
           AND EXISTS (
             SELECT 1
             FROM submission_feature_closure closure_ready
             WHERE closure_ready.source_submission_feature_id = ${featureAlias}.submission_feature_id
               AND closure_ready.target_submission_feature_id = ${featureAlias}.submission_feature_id
           )
           AND ${scopeAnchorAncestorPredicate(featureAlias, featureTypeAlias, urn)}`;
}

/**
 * Repository for security scope tables — the normalized access model that replaces
 * the materialized team_feature cache.
 *
 * The scope cache tables (`security_scope`, `security_scope_anchor`,
 * `team_security_scope`) are derived data.
 * They use hard-delete, not soft-delete, because they are recomputable
 * from the operational source of truth (policy_statement, team_policy).
 */
export class SecurityScopeRepository extends BaseRepository {
  /**
   * Insert a security scope if it doesn't already exist (deduplicated by scope_hash).
   *
   * Multiple policies can reference the same access scope (e.g., `urn:*:telemetry:*`).
   * Deduplication via SHA-256 hash prevents duplicate anchor computation and storage
   * explosion. The caller (SecurityScopeService) computes the hash from the URN.
   *
   * Uses ON CONFLICT DO NOTHING — returns the inserted row, or null if the scope
   * already exists. The service handles the existing-scope case with a separate lookup.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @param urn URN components stored on the reusable scope row
   * @returns The inserted SecurityScope, or null if scope_hash already exists
   */
  async insertSecurityScope(scopeHash: string, urn?: SecurityScopeUrn): Promise<SecurityScope | null> {
    const scopeUrn = urn ?? {
      urn_submission_id: '*',
      urn_feature_type: '*',
      urn_feature_id: '*'
    };
    const sqlStatement = SQL`
      INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
      VALUES (${scopeHash}, ${scopeUrn.urn_submission_id}, ${scopeUrn.urn_feature_type}, ${scopeUrn.urn_feature_id})
      ON CONFLICT (scope_hash) DO NOTHING
      RETURNING security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount === 0) {
      return null;
    }

    return response.rows[0];
  }

  /**
   * Insert or return the existing security scope for a scope_hash in one roundtrip.
   *
   * Uses an INSERT CTE plus fallback SELECT instead of `ON CONFLICT DO UPDATE`
   * so reusing an existing scope does not fire update/audit triggers.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @param urn URN components stored on the reusable scope row
   * @returns The inserted or existing SecurityScope
   */
  async ensureSecurityScope(scopeHash: string, urn: SecurityScopeUrn): Promise<SecurityScope> {
    const sqlStatement = SQL`
      WITH inserted AS (
        INSERT INTO security_scope (scope_hash, urn_submission_id, urn_feature_type, urn_feature_id)
        VALUES (${scopeHash}, ${urn.urn_submission_id}, ${urn.urn_feature_type}, ${urn.urn_feature_id})
        ON CONFLICT (scope_hash) DO NOTHING
        RETURNING security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      )
      SELECT security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      FROM inserted
      UNION ALL
      SELECT security_scope_id, scope_hash, urn_submission_id, urn_feature_type, urn_feature_id
      FROM security_scope
      WHERE scope_hash = ${scopeHash}
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to ensure security scope', [
        'SecurityScopeRepository->ensureSecurityScope',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find an existing security scope by its scope_hash.
   *
   * Used when insertSecurityScope returns null (scope already exists)
   * and the caller needs the existing scope's ID.
   *
   * @param scopeHash SHA-256 hex of the normalized URN string
   * @returns The existing SecurityScope
   * @throws ApiExecuteSQLError if no scope found (should not happen after a conflict)
   */
  async getSecurityScopeByScopeHash(scopeHash: string): Promise<SecurityScope> {
    const sqlStatement = SQL`
      SELECT security_scope_id, scope_hash
           , urn_submission_id, urn_feature_type, urn_feature_id
      FROM security_scope
      WHERE scope_hash = ${scopeHash};
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScope);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Security scope not found', [
        'SecurityScopeRepository->getSecurityScopeByScopeHash',
        'Expected scope to exist after ON CONFLICT, but no row found'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete one keyset-paginated batch of stale anchors for a security scope.
   *
   * An anchor becomes stale when its feature is no longer effectively secured
   * (neither it nor any ancestor has active security rules), unapproved (upload
   * decision changed), soft-deleted, or its URN no longer matches the scope's
   * policy statement. This is the inverse of the candidate criteria used by
   * `computeAnchorBatch` — any feature that wouldn't be selected as a new
   * candidate should not remain as an existing anchor.
   *
   * Called before the keyset insert loop so valid anchors are never deleted —
   * no transient search gap where the walk-up strategy can't find a matching anchor.
   *
   * Runs only for scopes currently referenced by an active approved ALLOW
   * statement. Anchors are reusable cache rows and do not grant access without
   * `team_security_scope`, so orphaned scopes keep their anchors for future reuse.
   *
   * **Why keyset pagination:** With ~10% of features secured per submission,
   * a scope can have 50k+ anchors. The monolithic DELETE runs
   * isEffectivelySecured() (a closure ancestry probe) per anchor row — 50k
   * probes + WAL + row locks in one transaction. Keyset pagination bounds memory and
   * WAL per batch.
   *
   * **All-valid-batch fallback:** When no anchors in a batch are stale, no rows
   * are deleted but the batch is not exhausted. A boundary query advances the
   * cursor past the fully-valid page.
   *
   * **Submission scope:** when `submissionId` is set, only anchors on that submission's features are
   * checked. Anchor validity depends only on the anchor's own submission graph and the scope's policy, so a
   * run triggered by one submission's graph change cannot make another submission's anchors stale.
   *
   * @param {string} securityScopeId Security scope identifier whose stale anchors are removed.
   * @param {number} afterId Keyset cursor; pass zero to start with the first anchor.
   * @param {number | null} submissionId Submission whose anchors are checked, or null to check every anchor.
   * @returns {Promise<AnchorBatchResult | null>} Next cursor position, or null when no anchors remain.
   * @memberof SecurityScopeRepository
   */
  async deleteStaleAnchorBatch(
    securityScopeId: string,
    afterId: number,
    submissionId: number | null
  ): Promise<AnchorBatchResult | null> {
    const values: (string | number)[] = [securityScopeId, afterId, SECURITY_SCOPE_ANCHOR_BATCH_SIZE];
    let anchorSubmissionJoin = '';

    if (submissionId !== null) {
      values.push(submissionId);
      anchorSubmissionJoin = `JOIN submission_feature scoped_anchor
           ON scoped_anchor.submission_feature_id = ssa.anchor_submission_feature_id
          AND scoped_anchor.submission_id = $4::integer`;
    }

    const result = await this.connection.query<{
      anchor_submission_feature_id: number;
      page_last_id: number;
    }>(
      `WITH active_scope AS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
         LIMIT 1
       ),
       batch AS (
         SELECT ssa.anchor_submission_feature_id
         FROM security_scope_anchor ssa
         ${anchorSubmissionJoin}
         WHERE ssa.security_scope_id = $1
           AND ssa.anchor_submission_feature_id > $2
           AND EXISTS (SELECT 1 FROM active_scope)
         ORDER BY ssa.anchor_submission_feature_id
         LIMIT $3
       )
       -- Return stale anchors: those NOT validated by any active policy statement
       SELECT b.anchor_submission_feature_id,
              (SELECT MAX(anchor_submission_feature_id) FROM batch) AS page_last_id
       FROM batch b
       WHERE EXISTS (
         -- Missing closure means the derived graph is invalidated or unavailable. Retain the anchor
         -- until a completed rebuild can prove whether it is stale.
         SELECT 1
         FROM submission_feature_closure closure_ready
         WHERE closure_ready.source_submission_feature_id = b.anchor_submission_feature_id
           AND closure_ready.target_submission_feature_id = b.anchor_submission_feature_id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         JOIN submission_feature anchor_sf ON anchor_sf.submission_feature_id = b.anchor_submission_feature_id
         JOIN feature_type ft ON ft.feature_type_id = anchor_sf.feature_type_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
           AND ${isSubmissionFeatureCurrent('anchor_sf')}
           AND (ss.urn_submission_id = anchor_sf.submission_id::text OR ss.urn_submission_id = '*')
           AND (ss.urn_feature_type = ft.name                       OR ss.urn_feature_type = '*')
           AND (ss.urn_feature_id = anchor_sf.submission_feature_id::text OR ss.urn_feature_id = '*')
           AND ${isEffectivelySecured('anchor_sf.submission_feature_id')}
       )`,
      values
    );

    if (result.rows.length > 0) {
      const staleIds = result.rows.map((r) => r.anchor_submission_feature_id);

      await this.connection.query(
        `DELETE FROM security_scope_anchor
         WHERE security_scope_id = $1
           AND anchor_submission_feature_id = ANY($2::INTEGER[])`,
        [securityScopeId, staleIds]
      );

      return { pageLastId: result.rows[0].page_last_id };
    }

    // No stale anchors in this batch — check if the batch had any anchors at all
    // to advance the cursor past valid anchors.
    const boundaryResult = await this.connection.query<{ last_id: number }>(
      `WITH active_scope AS (
         SELECT 1
         FROM security_scope ss
         JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
         JOIN policy p ON p.policy_id = ps.policy_id
         WHERE ss.security_scope_id = $1
           AND ps.record_end_date IS NULL
           AND ps.effect = '${PolicyEffect.ALLOW}'
           AND p.record_end_date IS NULL
           AND p.status = 'approved'
         LIMIT 1
       )
       SELECT MAX(ssa.anchor_submission_feature_id) AS last_id
       FROM (
         SELECT ssa.anchor_submission_feature_id
         FROM security_scope_anchor ssa
         ${anchorSubmissionJoin}
         WHERE ssa.security_scope_id = $1
           AND ssa.anchor_submission_feature_id > $2
           AND EXISTS (SELECT 1 FROM active_scope)
         ORDER BY ssa.anchor_submission_feature_id
         LIMIT $3
       ) ssa`,
      values
    );

    if (!boundaryResult.rows[0]?.last_id) {
      return null;
    }

    return { pageLastId: boundaryResult.rows[0].last_id };
  }

  /**
   * Resolve the URN pattern for a security scope.
   *
   * Returns the reusable scope URN components when at least one active approved
   * ALLOW statement still references the scope.
   *
   * @param securityScopeId UUID of the security scope
   * @returns URN components, or null if the scope has no active policy statements
   */
  async resolveUrnForScope(securityScopeId: string): Promise<SecurityScopeUrn | null> {
    const result = await this.connection.query<SecurityScopeUrn>(
      `SELECT ss.urn_submission_id, ss.urn_feature_type, ss.urn_feature_id
       FROM security_scope ss
       JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
       JOIN policy p ON p.policy_id = ps.policy_id
       WHERE ss.security_scope_id = $1
         AND ps.record_end_date IS NULL
         AND ps.effect = '${PolicyEffect.ALLOW}'
         AND p.record_end_date IS NULL
         AND p.status = 'approved'
       LIMIT 1`,
      [securityScopeId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Insert one keyset-paginated batch of anchor rows into `security_scope_anchor`.
   *
   * Anchors mark the highest point in each feature hierarchy that satisfies the
   * scope's URN pattern with no qualifying ancestor above it.
   *
   * A feature is "effectively secured" if it or any ancestor has an active
   * security rule — security cascades down the hierarchy. For example,
   * `urn:*:telemetry:*` anchors telemetry features whose parent survey is
   * secured, even though the telemetry features themselves have no direct
   * security rule.
   *
   * Only features from approved uploads are eligible — features still under
   * review (decision = 'pending') must not affect security scope anchors.
   *
   * **Why keyset pagination:** Even though `*:*:*` scopes are not supported,
   * a single submission-scoped URN (`urn:{subId}:*:*`) can still match 1M+
   * features. A monolithic query would materialize the entire candidate set and
   * its closure ancestry in work_mem before results can be consumed. Keyset
   * pagination bounds memory per batch at the cost of repeated index probes —
   * trading time for OOM safety, acceptable for a background job.
   *
   * **Why re-evaluate candidate criteria per ancestor instead of referencing a
   * materialized candidate set:** Each batch's `has_candidate_ancestor` CTE checks
   * ancestor candidacy via index lookups against the base tables, rather than
   * joining to a materialized candidate set. This keeps memory bounded per batch.
   *
   * **All-pruned-batch fallback:** When every candidate in a batch is pruned (each
   * has a candidate ancestor), no rows are inserted but the batch is not exhausted.
   * A separate boundary query re-runs the same candidate criteria to find the page
   * maximum and advance the cursor past the fully-pruned page.
   *
   * Insert-only with ON CONFLICT DO NOTHING — called after `deleteStaleAnchorBatch`
   * removes invalid anchors, so existing valid anchors are simply skipped.
   *
   * The caller (service) manages transaction boundaries — each batch call runs
   * inside its own BEGIN/COMMIT to bound WAL retention and allow VACUUM between batches.
   * ON CONFLICT DO NOTHING makes each batch idempotent, so partial completion
   * followed by retry is safe.
   *
   * **Submission scope:** when `submissionId` is set, candidates are limited to that submission's features
   * with an indexable equality on `submission_feature (submission_id, submission_feature_id)`, which also
   * serves the keyset order. The text URN predicates stay in place, so the result is the same subset the
   * unscoped scan would select from that submission.
   *
   * @param {string} securityScopeId Security scope identifier whose anchors are computed.
   * @param {SecurityScopeUrn} urn URN components resolved through {@link resolveUrnForScope}.
   * @param {number} afterId Keyset cursor; pass zero to start with the first candidate.
   * @param {number | null} submissionId Submission whose features are candidates, or null for every submission.
   * @returns {Promise<AnchorBatchResult | null>} Next cursor position, or null when no candidates remain.
   * @memberof SecurityScopeRepository
   */
  async computeAnchorBatch(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    afterId: number,
    submissionId: number | null
  ): Promise<AnchorBatchResult | null> {
    const values: (string | number)[] = [
      afterId,
      urn.urn_submission_id,
      urn.urn_feature_type,
      urn.urn_feature_id,
      SECURITY_SCOPE_ANCHOR_BATCH_SIZE
    ];
    const urnSql: ScopeUrnSql = { submissionId: '$2', featureType: '$3', featureId: '$4' };
    let candidateSubmissionPredicate = '';

    if (submissionId !== null) {
      values.push(submissionId);
      candidateSubmissionPredicate = 'AND candidate.submission_id = $6::integer';
    }

    const result = await this.connection.query<{
      submission_feature_id: number;
      page_last_id: number;
    }>(
      `WITH batch AS (
         SELECT candidate.submission_feature_id
         FROM submission_feature candidate
         JOIN feature_type ft ON ft.feature_type_id = candidate.feature_type_id
         WHERE ${scopeAnchorCandidatePredicate('candidate', 'ft', urnSql)}
           AND candidate.submission_feature_id > $1
           ${candidateSubmissionPredicate}
         ORDER BY candidate.submission_feature_id
         LIMIT $5
       ),

       -- Closure is the authoritative current parent graph. Re-evaluate candidate criteria for
       -- each proper ancestor (excluding the reflexive self-loop) via indexed closure lookups.
       has_candidate_ancestor AS (
         SELECT DISTINCT b.submission_feature_id AS candidate_id
         FROM batch b
         JOIN submission_feature_closure ancestry
           ON ancestry.source_submission_feature_id = b.submission_feature_id
          AND ancestry.target_submission_feature_id <> b.submission_feature_id
          AND ancestry.is_ancestor = true
         JOIN submission_feature ancestor
           ON ancestor.submission_feature_id = ancestry.target_submission_feature_id
         JOIN feature_type ft ON ft.feature_type_id = ancestor.feature_type_id
         WHERE ${scopeAnchorAncestorPredicate('ancestor', 'ft', urnSql)}
       )

       -- Prune to topmost candidates only (anchors). A candidate with a candidate
       -- ancestor is not a root — it's reachable via the walk-up search from the
       -- ancestor anchor, so storing it would be redundant. page_last_id is the MAX
       -- of the full pre-pruning batch so the keyset advances past the entire page.
       SELECT b.submission_feature_id,
              (SELECT MAX(submission_feature_id) FROM batch) AS page_last_id
       FROM batch b
       WHERE NOT EXISTS (
         SELECT 1 FROM has_candidate_ancestor hca
         WHERE hca.candidate_id = b.submission_feature_id
       )`,
      values
    );

    if (result.rows.length > 0) {
      const featureIds = result.rows.map((r) => r.submission_feature_id);

      await this.connection.query(
        `INSERT INTO security_scope_anchor (security_scope_id, anchor_submission_feature_id)
         SELECT $1, unnest($2::INTEGER[])
         ON CONFLICT (security_scope_id, anchor_submission_feature_id) DO NOTHING`,
        [securityScopeId, featureIds]
      );

      return { pageLastId: result.rows[0].page_last_id };
    }

    // All candidates in this batch were pruned (every candidate had a candidate
    // ancestor). Re-query for just the page boundary to advance the keyset.
    // This boundary query uses the same candidate criteria as the batch CTE above (one shared
    // predicate and the same cursor and submission tests) or the keyset will skip/repeat candidates.
    const boundaryResult = await this.connection.query<{ last_id: number }>(
      `SELECT MAX(candidate.submission_feature_id) AS last_id
       FROM (
         SELECT candidate.submission_feature_id
         FROM submission_feature candidate
         JOIN feature_type ft ON ft.feature_type_id = candidate.feature_type_id
         WHERE ${scopeAnchorCandidatePredicate('candidate', 'ft', urnSql)}
           AND candidate.submission_feature_id > $1
           ${candidateSubmissionPredicate}
         ORDER BY candidate.submission_feature_id
         LIMIT $5
       ) candidate`,
      values
    );

    if (!boundaryResult.rows[0]?.last_id) {
      return null;
    }

    return { pageLastId: boundaryResult.rows[0].last_id };
  }

  /**
   * SQL text of the subquery that aggregates the features a scope grants into one bitmap, shared by
   * the full build ({@link updateSecurityScopeFeatureIds}) and the per-submission refresh
   * ({@link updateSecurityScopeFeatureIdsForSubmission}) so the two cannot drift.
   *
   * The result is NULL, not an empty bitmap, when the scope grants nothing; callers COALESCE it.
   *
   * @param {ScopeUrnSql} urnSql SQL text for the scope URN components.
   * @param {string} submissionPredicate `AND`-prefixed predicate limiting `anchor` to one submission, or
   * an empty string for every submission. Trusted text only, never user input.
   * @returns {string} A scalar `SELECT rb_build_agg(...)` subquery, without enclosing parentheses.
   * @memberof SecurityScopeRepository
   */
  private buildScopeFeatureIdsQuery(urnSql: ScopeUrnSql, submissionPredicate: string): string {
    return `SELECT rb_build_agg(member.submission_feature_id)
         FROM submission_feature anchor
         JOIN feature_type anchor_ft ON anchor_ft.feature_type_id = anchor.feature_type_id
         JOIN submission_feature_closure reach
           ON reach.target_submission_feature_id = anchor.submission_feature_id
          AND reach.is_ancestor = true
         JOIN submission_feature member
           ON member.submission_feature_id = reach.source_submission_feature_id
         WHERE ${scopeAnchorCandidatePredicate('anchor', 'anchor_ft', urnSql)}
           ${submissionPredicate}
           -- A candidate with a candidate ancestor is not an anchor; its ancestor's anchor reaches it.
           AND NOT EXISTS (
             SELECT 1
             FROM submission_feature_closure ancestry
             JOIN submission_feature ancestor
               ON ancestor.submission_feature_id = ancestry.target_submission_feature_id
             JOIN feature_type ancestor_ft ON ancestor_ft.feature_type_id = ancestor.feature_type_id
             WHERE ancestry.source_submission_feature_id = anchor.submission_feature_id
               AND ancestry.target_submission_feature_id <> anchor.submission_feature_id
               AND ancestry.is_ancestor = true
               AND ${scopeAnchorAncestorPredicate('ancestor', 'ancestor_ft', urnSql)}
           )
           -- Only available members count: current, with a closure self-loop.
           AND ${isSubmissionFeatureCurrent('member')}
           AND EXISTS (
             SELECT 1
             FROM submission_feature_closure member_ready
             WHERE member_ready.source_submission_feature_id = member.submission_feature_id
               AND member_ready.target_submission_feature_id = member.submission_feature_id
           )`;
  }

  /**
   * Rebuild the feature bitmap of a security scope: `security_scope.feature_ids`.
   *
   * The bitmap holds every feature the scope grants: each anchor of the scope and the anchor's
   * descendants (closure rows with `is_ancestor = true`, which include the anchor's own self-loop),
   * limited to available features — current, with a closure self-loop. Descendants are not tested
   * against the URN or for security: an anchor grants its whole subtree, other feature types included.
   *
   * Anchors are re-derived here with the predicates `computeAnchorBatch` uses rather than read from
   * `security_scope_anchor`, because the anchor job may not have run when this does. A scope that
   * grants nothing stores an empty bitmap, not NULL.
   *
   * The whole set is aggregated and run-optimised inside the database in one statement; no feature
   * id is returned to the caller. Rebuilding on unchanged data stores the same value, so a retry is safe.
   *
   * **Submission scope:** when `submissionId` is set, anchors are limited to that submission's features
   * with an indexable equality on `submission_feature (submission_id, submission_feature_id)`. Closure
   * is per submission, so the members are that submission's features too.
   *
   * @param {string} securityScopeId Security scope identifier whose bitmap is rebuilt.
   * @param {SecurityScopeUrn} urn URN components resolved through {@link resolveUrnForScope}.
   * @param {number | null} submissionId Submission the scope URN names, or null for every submission.
   * @returns {Promise<void>}
   * @throws {ApiExecuteSQLError} If the scope row was not updated.
   * @memberof SecurityScopeRepository
   */
  async updateSecurityScopeFeatureIds(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    submissionId: number | null
  ): Promise<void> {
    const values: (string | number)[] = [
      securityScopeId,
      urn.urn_submission_id,
      urn.urn_feature_type,
      urn.urn_feature_id
    ];
    const urnSql: ScopeUrnSql = { submissionId: '$2', featureType: '$3', featureId: '$4' };
    let anchorSubmissionPredicate = '';

    if (submissionId !== null) {
      values.push(submissionId);
      anchorSubmissionPredicate = 'AND anchor.submission_id = $5::integer';
    }

    const result = await this.connection.query(
      `UPDATE security_scope ss
       SET feature_ids = rb_runoptimize(COALESCE((
         ${this.buildScopeFeatureIdsQuery(urnSql, anchorSubmissionPredicate)}
       ), rb_build('{}'::integer[])))
       WHERE ss.security_scope_id = $1`,
      values
    );

    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security scope feature ids', [
        'SecurityScopeRepository->updateSecurityScopeFeatureIds',
        `rowCount was ${result.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Refresh one submission's part of a security scope's feature bitmap: `security_scope.feature_ids`.
   *
   * Every feature id of the submission, current or not, is removed from the stored bitmap, and the
   * ids a full build would grant for that submission are added back, so superseded and ended
   * features leave the bitmap and ids of other submissions are untouched. The stored bitmap is read
   * from the row being updated; the caller locks that row first
   * ({@link lockSecurityScopeForFeatureIdsUpdate}) so writers of one scope's bitmap run one at a time.
   *
   * Updating no row is a normal result and does not throw: the refreshed bitmap equals the stored
   * one (the row is not rewritten), the bitmap is NULL (the full build owns the first build), or the
   * scope no longer exists.
   *
   * @param {string} securityScopeId Security scope identifier whose bitmap is refreshed.
   * @param {SecurityScopeUrn} urn URN components resolved through {@link resolveUrnForScope}.
   * @param {number} submissionId Submission whose ids are replaced in the bitmap.
   * @returns {Promise<void>}
   * @memberof SecurityScopeRepository
   */
  async updateSecurityScopeFeatureIdsForSubmission(
    securityScopeId: string,
    urn: SecurityScopeUrn,
    submissionId: number
  ): Promise<void> {
    const values: (string | number)[] = [
      securityScopeId,
      urn.urn_submission_id,
      urn.urn_feature_type,
      urn.urn_feature_id,
      submissionId
    ];
    const urnSql: ScopeUrnSql = { submissionId: '$2', featureType: '$3', featureId: '$4' };

    await this.connection.query(
      `UPDATE security_scope ss
       SET feature_ids = rb_runoptimize(rb_or(rb_andnot(ss.feature_ids, part.submission_ids), part.fresh_ids))
       FROM (
         SELECT
           -- Every feature row of the submission, current or not.
           COALESCE((
             SELECT rb_build_agg(sf.submission_feature_id)
             FROM submission_feature sf
             WHERE sf.submission_id = $5::integer
           ), rb_build('{}'::integer[])) AS submission_ids,
           COALESCE((
         ${this.buildScopeFeatureIdsQuery(urnSql, 'AND anchor.submission_id = $5::integer')}
           ), rb_build('{}'::integer[])) AS fresh_ids
       ) part
       WHERE ss.security_scope_id = $1
         AND ss.feature_ids IS NOT NULL
         -- Skip the write when the refreshed bitmap equals the stored one.
         AND ss.feature_ids IS DISTINCT FROM
             rb_runoptimize(rb_or(rb_andnot(ss.feature_ids, part.submission_ids), part.fresh_ids))`,
      values
    );
  }

  /**
   * Lock a security scope's row for a write to its feature bitmap, until the transaction ends.
   *
   * `FOR NO KEY UPDATE` is the lock the bitmap UPDATE takes anyway: it blocks other writers of the
   * row, not readers or inserts that reference the scope. Taken as its own statement, it makes the
   * UPDATE that follows start after any in-flight writer of the bitmap has committed, and see its data.
   *
   * @param {string} securityScopeId Security scope identifier whose row is locked.
   * @returns {Promise<void>}
   * @memberof SecurityScopeRepository
   */
  async lockSecurityScopeForFeatureIdsUpdate(securityScopeId: string): Promise<void> {
    const sqlStatement = SQL`
      SELECT 1 FROM security_scope WHERE security_scope_id = ${securityScopeId} FOR NO KEY UPDATE;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Lock the row of every security scope whose URN matches a submission — the scopes naming it and the
   * wildcard scopes — for a write to their feature bitmaps, until the transaction ends.
   *
   * Scopes are matched on the URN alone: no team link is required and a bitmap that was never built
   * is locked too, so a removal waits for a first full build in flight and then clears what it wrote.
   * Rows are locked in `security_scope_id` order, so two removals that share scopes cannot deadlock.
   *
   * A scope committed while this statement waited on a lock is not in its result; the caller repeats
   * the statement until it locks nothing new.
   *
   * @param {number} submissionId Submission whose matching scopes are locked.
   * @returns {Promise<SecurityScopeId[]>} The locked scopes.
   * @memberof SecurityScopeRepository
   */
  async lockSecurityScopesForSubmissionFeatureIdsUpdate(submissionId: number): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT security_scope_id
      FROM security_scope
      WHERE urn_submission_id = ${String(submissionId)} OR urn_submission_id = '*'
      ORDER BY security_scope_id
      FOR NO KEY UPDATE;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }

  /**
   * Remove every feature id of a submission from the feature bitmap of every security scope whose
   * URN matches it: `security_scope.feature_ids`.
   *
   * Run when rule assignments are removed, in the transaction that removes them, so no bitmap keeps
   * granting a feature that was covered only through a removed rule. Every feature row of the
   * submission is removed, current or not; ids of other submissions are untouched. Scopes are
   * matched on the URN alone, with or without a linked team. The caller locks the matching rows
   * first ({@link lockSecurityScopesForSubmissionFeatureIdsUpdate}).
   *
   * Updating no row is a normal result and does not throw: a bitmap that was never built stays NULL,
   * and a bitmap holding none of the submission's ids is not rewritten.
   *
   * @param {number} submissionId Submission whose ids are removed from the bitmaps.
   * @returns {Promise<void>}
   * @memberof SecurityScopeRepository
   */
  async updateSecurityScopeFeatureIdsWithoutSubmission(submissionId: number): Promise<void> {
    await this.connection.query(
      `UPDATE security_scope ss
       SET feature_ids = rb_runoptimize(rb_andnot(ss.feature_ids, part.submission_ids))
       FROM (
         -- Every feature row of the submission, current or not.
         SELECT COALESCE((
           SELECT rb_build_agg(sf.submission_feature_id)
           FROM submission_feature sf
           WHERE sf.submission_id = $1::integer
         ), rb_build('{}'::integer[])) AS submission_ids
       ) part
       WHERE (ss.urn_submission_id = $1::text OR ss.urn_submission_id = '*')
         AND ss.feature_ids IS NOT NULL
         -- Skip bitmaps that hold none of the submission's ids.
         AND rb_intersect(ss.feature_ids, part.submission_ids)`,
      [submissionId]
    );
  }

  /**
   * Lock the row of each of the given security scopes that no team holds (a scope with no
   * `team_security_scope` row) for a write to its feature bitmap, until the transaction ends.
   *
   * Taken as its own statement before {@link updateUnheldSecurityScopeFeatureIdsToNull}, so that
   * statement starts after any in-flight writer of these rows has committed and sees its data: a
   * bitmap build, or another request giving the same scope to a team. A scope a team already holds
   * is not locked.
   *
   * Rows are locked in `security_scope_id` order within one call. A caller that locks for several
   * policies in one transaction takes locks across calls in the order it makes them, so it can
   * still deadlock with another writer of the same rows; PostgreSQL then aborts one of the two.
   *
   * @param {string[]} securityScopeIds Security scope identifiers to check.
   * @returns {Promise<SecurityScopeId[]>} The locked scopes: those no team held when the statement ran.
   * @memberof SecurityScopeRepository
   */
  async lockUnheldSecurityScopesForFeatureIdsUpdate(securityScopeIds: string[]): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT ss.security_scope_id
      FROM security_scope ss
      WHERE ss.security_scope_id = ANY(${securityScopeIds}::uuid[])
        AND NOT EXISTS (
          SELECT 1
          FROM team_security_scope tss
          WHERE tss.security_scope_id = ss.security_scope_id
        )
      ORDER BY ss.security_scope_id
      FOR NO KEY UPDATE OF ss;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }

  /**
   * Set the feature bitmap (`security_scope.feature_ids`) to NULL for each of the given security scopes
   * that no team holds: a scope with no `team_security_scope` row.
   *
   * Run before a team is given a scope, in the transaction that gives it. A bitmap is refreshed only
   * while its scope is held, so the bitmap of a scope that had no holder may be out of date. A NULL
   * bitmap grants nothing, so the scope's new holders get no access through it until the full build
   * queued with the grant has run. A scope a team already holds is left as it is.
   *
   * The caller locks the rows first ({@link lockUnheldSecurityScopesForFeatureIdsUpdate}) and passes
   * the locked scopes. Holders are checked again here, in a statement that starts after the lock is
   * held: a scope another request gave to a team while the lock was waited for is left as it is.
   *
   * Updating no row is a normal result and does not throw: every given scope is held.
   *
   * @param {string[]} securityScopeIds Security scope identifiers to check, already locked.
   * @returns {Promise<void>}
   * @memberof SecurityScopeRepository
   */
  async updateUnheldSecurityScopeFeatureIdsToNull(securityScopeIds: string[]): Promise<void> {
    const sqlStatement = SQL`
      UPDATE security_scope ss
      SET feature_ids = NULL
      WHERE ss.security_scope_id = ANY(${securityScopeIds}::uuid[])
        AND NOT EXISTS (
          SELECT 1
          FROM team_security_scope tss
          WHERE tss.security_scope_id = ss.security_scope_id
        );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Filter a list of scope IDs to those with no remaining active approved ALLOW
   * statement references.
   *
   * @param scopeIds Candidate scope IDs to check
   * @returns Scope IDs that no longer grant standing access through any policy
   */
  async findScopeIdsWithoutActiveApprovedAllowStatements(scopeIds: string[]): Promise<SecurityScopeId[]> {
    if (scopeIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex
      .select('s.security_scope_id')
      .from(knex.raw('unnest(?::UUID[]) AS s(security_scope_id)', [scopeIds]))
      .whereNotExists(function () {
        this.select(knex.raw('1'))
          .from('policy_statement as ps')
          .join('policy as p', 'p.policy_id', 'ps.policy_id')
          .whereRaw('ps.security_scope_id = s.security_scope_id')
          .whereNull('ps.record_end_date')
          .where('ps.effect', PolicyEffect.ALLOW)
          .whereNull('p.record_end_date')
          .where('p.status', 'approved');
      });

    const response = await this.connection.knex(query, SecurityScopeId);

    return response.rows;
  }

  /**
   * Insert team_security_scope rows for a team's scopes derived from a specific policy.
   *
   * The team-link invariant — cache rows exist iff a live `team_policy` ties the
   * team to an approved policy with at least one ALLOW statement — is enforced
   * in this SQL via the `team_policy` join. A stale caller that holds onto a
   * `(teamId, policyId)` pair after the link has been soft-deleted cannot
   * recreate cache rows; the join filters them out.
   *
   * ON CONFLICT DO NOTHING makes this safe for idempotent calls — a team may
   * already have access to the same scope through a different policy.
   *
   * @param teamId UUID of the team
   * @param policyId UUID of the policy granting scope access
   */
  async insertTeamSecurityScopesForPolicy(teamId: string, policyId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT tp.team_id, ps.security_scope_id
      FROM team_policy tp
      JOIN policy p
        ON p.policy_id = tp.policy_id
        AND p.status = 'approved'
        AND p.record_end_date IS NULL
      JOIN policy_statement ps
        ON ps.policy_id = p.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      JOIN team t
        ON t.team_id = tp.team_id
        AND t.record_end_date IS NULL
      WHERE tp.team_id = ${teamId}
        AND tp.policy_id = ${policyId}
        AND tp.record_end_date IS NULL
      ON CONFLICT (team_id, security_scope_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete all team_security_scope rows for a team.
   *
   * @param teamId UUID of the team
   */
  async deleteTeamSecurityScopes(teamId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM team_security_scope WHERE team_id = ${teamId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Re-derive team_security_scope rows for a team from the active policy chain.
   *
   * Walks team_policy → policy_statement.security_scope_id to find all
   * scopes the team should have access to. ON CONFLICT DO NOTHING handles
   * duplicate scopes reached through multiple policies.
   *
   * @param teamId UUID of the team
   */
  async insertTeamSecurityScopesFromPolicyChain(teamId: string): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO team_security_scope (team_id, security_scope_id)
      SELECT tp.team_id, ps.security_scope_id
      FROM team_policy tp
      JOIN team t
        ON t.team_id = tp.team_id
        AND t.record_end_date IS NULL
      JOIN policy p
        ON p.policy_id = tp.policy_id
        AND p.record_end_date IS NULL
        AND p.status = 'approved'
      JOIN policy_statement ps
        ON ps.policy_id = tp.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      WHERE tp.team_id = ${teamId}
        AND tp.record_end_date IS NULL
      ON CONFLICT (team_id, security_scope_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Return the active ALLOW statements for an approved policy.
   *
   * The scope cache materializes lazily — when a team gains standing access through
   * a `team_policy` link or when a policy's status flips to `approved`. Only ALLOW
   * statements on an approved policy contribute access; DENY statements record
   * filters but do not produce visible cache rows. Both gates (`policy.status` and
   * `policy_statement.effect`) are enforced here so the service layer can stay thin.
   *
   * Returns an empty array when the policy is not approved, has no active ALLOW
   * statements, or does not exist — callers treat `[]` as a no-op signal.
   *
   * @param policyId UUID of the policy
   * @returns Array of `{ security_scope_id }` for active ALLOW statements
   */
  async findActiveAllowStatementsForApprovedPolicy(policyId: string): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT ps.security_scope_id
      FROM policy p
      JOIN policy_statement ps
        ON ps.policy_id = p.policy_id
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND ps.record_end_date IS NULL
      WHERE p.policy_id = ${policyId}
        AND p.status = 'approved'
        AND p.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }

  /**
   * Find security_scope IDs whose originating policy statement URN matches a submission.
   *
   * Used when new security rules are applied to features in a submission —
   * finds scopes that may need new anchors computed for the affected submission.
   *
   * A live `team_policy` link is required: a scope without one grants access to
   * no team, so anchor recomputation for it is wasted work. Gating here keeps
   * anchor-compute jobs scoped to the standing-access cache.
   *
   * @param submissionId The submission ID to match against scope URNs
   * @returns Array of SecurityScopeId rows for matching scopes
   */
  async findScopeIdsMatchingSubmission(submissionId: number): Promise<SecurityScopeId[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT ps.security_scope_id
      FROM policy_statement ps
      JOIN security_scope ss ON ss.security_scope_id = ps.security_scope_id
      JOIN policy p ON p.policy_id = ps.policy_id
      JOIN team_policy tp ON tp.policy_id = p.policy_id AND tp.record_end_date IS NULL
      WHERE ps.record_end_date IS NULL
        AND ps.effect = ${PolicyEffect.ALLOW}
        AND p.record_end_date IS NULL
        AND p.status = 'approved'
        AND (ss.urn_submission_id = ${String(submissionId)} OR ss.urn_submission_id = '*');
    `;

    const response = await this.connection.sql(sqlStatement, SecurityScopeId);

    return response.rows;
  }
}
