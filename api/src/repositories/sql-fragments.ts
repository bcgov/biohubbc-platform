/**
 * Reusable SQL fragment builders for repository queries.
 *
 * These return raw SQL strings intended for interpolation into larger queries.
 * They are NOT parameterized — callers must only pass trusted column references
 * (e.g. 'sf.submission_feature_id'), never user input.
 */

import { Knex } from 'knex';

/**
 * Per-row "effectively secured" check: walks UP from a feature through its
 * ancestors to determine if it or any ancestor has an active security rule
 * whose feature is past its effective date.
 *
 * Returns an `EXISTS (...)` SQL expression suitable for use in WHERE clauses
 * or as a SELECT column (returns boolean).
 *
 * Cost is O(tree_depth) per row (~3–5 levels), bounded by the feature
 * hierarchy depth regardless of total feature count.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'candidate.submission_feature_id')
 */
export function isEffectivelySecured(featureIdExpr: string): string {
  return `EXISTS (
    WITH RECURSIVE ancestor_chain(id) AS (
      SELECT ${featureIdExpr}
      UNION ALL
      SELECT p.parent_submission_feature_id
      FROM ancestor_chain ac
      JOIN submission_feature p ON p.submission_feature_id = ac.id
      WHERE p.parent_submission_feature_id IS NOT NULL
        AND p.record_end_date IS NULL
    )
    SELECT 1 FROM ancestor_chain ac
    JOIN submission_feature_security sfs ON sfs.submission_feature_id = ac.id
    JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = ac.id
    WHERE sfs.record_end_date IS NULL
      AND sf_sec.record_effective_date <= now()
  )`;
}

/**
 * Combined security + scope-grant check for authenticated users. Walks the ancestor
 * chain ONCE, then checks two conditions against the materialized CTE:
 *
 * 1. Feature is NOT effectively secured (no active approved security rule in chain), OR
 * 2. User has a team scope grant via `security_scope_anchor` in the ancestor chain
 *
 * Returns an `EXISTS (...)` SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * This avoids the double-walk penalty of calling `isEffectivelySecured` and a separate
 * scope-grant check independently — both reuse the same recursive ancestor traversal.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'aggregated_results.submission_feature_id')
 */
export function isAccessibleToUser(featureIdExpr: string): string {
  return `EXISTS (
    -- Walk up the feature hierarchy once, materialized by PostgreSQL
    WITH RECURSIVE ancestor_chain(id) AS (
      SELECT ${featureIdExpr}
      UNION ALL
      SELECT p.parent_submission_feature_id
      FROM ancestor_chain ac
      JOIN submission_feature p ON p.submission_feature_id = ac.id
      WHERE p.parent_submission_feature_id IS NOT NULL
        AND p.record_end_date IS NULL
    )
    SELECT 1
    WHERE
      -- Branch 1: feature is NOT effectively secured (no active approved security rule in chain)
      NOT EXISTS (
        SELECT 1 FROM ancestor_chain ac
        JOIN submission_feature_security sfs ON sfs.submission_feature_id = ac.id
        JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = ac.id
        WHERE sfs.record_end_date IS NULL
          AND sf_sec.record_effective_date <= now()
      )
      -- Branch 2: user has a team scope grant via an anchor in the ancestor chain
      OR EXISTS (
        SELECT 1 FROM ancestor_chain ac
        JOIN security_scope_anchor ssa ON ssa.anchor_submission_feature_id = ac.id
        JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
        JOIN team t ON t.team_id = tss.team_id
          AND t.record_end_date IS NULL
        JOIN team_member tm ON tm.team_id = tss.team_id
          AND tm.system_user_id = ?  -- bound by caller
          AND tm.record_end_date IS NULL
      )
  )`;
}

/**
 * Builds a single security filter that walks ancestors once per candidate feature and checks:
 *   1. Unsecured — no ancestor has a submission_feature_security row → visible
 *   2. Secured + granted — any ancestor is a scope anchor the user's team can reach → visible
 *   3. Secured + denied — secured but no matching scope anchor → filtered out
 *
 * For anonymous users (systemUserId is null), only unsecured features pass.
 *
 * Composes the shared fragments above:
 * - `isEffectivelySecured` — a feature is "effectively secured" only when it or an ancestor
 *   has an active security rule AND the feature is past its `record_effective_date`.
 * - `isAccessibleToUser` — walks ancestors to find a scope anchor the user's team can reach.
 *
 * Walk-up (not expand-down) strategy: callers have already narrowed features to a small
 * candidate set. For each candidate, walk UP the parent chain (~3-5 levels) to check
 * scope anchors. Cost is O(candidates × depth), not O(features in scope).
 *
 * Shared by the filter-based search wrapper and the expression-tree evaluator so both
 * read paths apply identical security semantics.
 *
 * @param knex - Knex instance
 * @param systemUserId - The authenticated user's ID, or null for anonymous, or undefined
 *   for internal callers that should not be security-filtered.
 * @param submissionFeatureIdColumn - Fully-qualified candidate feature id column.
 * @returns Raw SQL fragment for WHERE clause, or null if no filtering needed.
 */
export function buildSecurityFilter(
  knex: Knex,
  systemUserId: number | null | undefined,
  submissionFeatureIdColumn = 'aggregated_results.submission_feature_id'
): Knex.Raw | null {
  if (systemUserId === undefined) {
    return null;
  }

  if (!systemUserId) {
    // Anonymous: only unsecured features
    return knex.raw(`NOT ${isEffectivelySecured(submissionFeatureIdColumn)}`);
  }

  // Authenticated: feature is unsecured OR user has team scope grant (single ancestor walk)
  return knex.raw(`${isAccessibleToUser(submissionFeatureIdColumn)}`, [systemUserId]);
}
