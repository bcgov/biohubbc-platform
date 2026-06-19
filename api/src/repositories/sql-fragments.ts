/**
 * Reusable SQL fragment builders for repository queries.
 *
 * These return raw SQL strings intended for interpolation into larger queries.
 * They are NOT parameterized — callers must only pass trusted column references
 * (e.g. 'sf.submission_feature_id'), never user input.
 */

import { Knex } from 'knex';

/**
 * Closure-based "effectively secured" check used on every security-resolving path —
 * the hot read paths (search / cart / download) and the scope-anchor recompute write
 * path: a feature is effectively secured when it or an ancestor has an active security
 * rule that is past its effective date.
 *
 * Instead of a per-row recursive parent walk, this reads the precomputed
 * `submission_feature_closure` ancestry subset — `is_ancestor = true`, which is the
 * pure parent-ancestry reach including the feature's own self-loop `(F, F)` — joined
 * to the security tables. The ancestry lookup is served by the closure primary key on
 * `source_submission_feature_id`; the security joins are index-served on
 * `target_submission_feature_id`. This matters because it runs on every search, cart,
 * and download request.
 *
 * Fails closed on missing closure rows. The closure is built by an async recompute job
 * that runs *after* an upload is flipped to `indexed` (and therefore searchable), in a
 * separate transaction; a recompute that has not yet run, or that failed, does not revert
 * that status. So an active, searchable, secured feature can transiently — or, on a failed
 * recompute, indefinitely — have no closure rows. Rather than read "no rows" as "unsecured"
 * (which would leak the feature), this check treats the absence of any closure ancestry row
 * as secured: if we cannot prove a feature is unsecured, we hide it. Under normal operation
 * every active feature carries at least its self-loop `(F, F)`, so the fail-closed branch is
 * inert on the happy path.
 *
 * Returns an `EXISTS (...)` SQL expression (returns boolean) with zero `?` placeholders.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'expression_results.submission_feature_id')
 */
export function isEffectivelySecured(featureIdExpr: string): string {
  return `(
    EXISTS (
      SELECT 1
      FROM submission_feature_closure c
      JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
      JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = c.target_submission_feature_id
      WHERE c.source_submission_feature_id = ${featureIdExpr}
        AND c.is_ancestor = true
        AND sfs.record_end_date IS NULL
        AND sfs.status = 'active'
        AND sf_sec.record_effective_date <= now()
    )
    -- Fail closed: the reflexive self-loop (F, F) is written for every active feature when its upload's
    -- closure is built, so its absence means the closure is not built (recompute not yet run, or failed).
    -- We then cannot prove the feature is unsecured — treat it as secured rather than leak it. This is a
    -- direct primary-key probe ((source, target) is the PK).
    OR NOT EXISTS (
      SELECT 1
      FROM submission_feature_closure c
      WHERE c.source_submission_feature_id = ${featureIdExpr}
        AND c.target_submission_feature_id = ${featureIdExpr}
    )
  )`;
}

/**
 * Combined security + scope-grant check for authenticated users on the read paths.
 * A feature is accessible when either:
 *
 * 1. The feature is NOT effectively secured (no active approved security rule in its
 *    ancestry), OR
 * 2. The user has a team scope grant via a `security_scope_anchor` on an ancestor.
 *
 * Returns an `EXISTS (...)` SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * This reads the precomputed `submission_feature_closure` ancestry subset
 * (`is_ancestor = true`) instead of doing a recursive parent walk. Branch 1 reuses
 * `isEffectivelySecured`; Branch 2 probes the closure for an ancestor that is
 * a scope anchor the user's team can reach. Both are cheap PK-served closure probes
 * (`source_submission_feature_id`), so the old concern of walking the ancestor chain
 * twice no longer applies — there is no recursive walk at all.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'aggregated_results.submission_feature_id')
 */
export function isAccessibleToUser(featureIdExpr: string): string {
  return `EXISTS (
    SELECT 1
    WHERE
      -- Branch 1: feature is NOT effectively secured
      NOT ${isEffectivelySecured(featureIdExpr)}
      -- Branch 2: user has a team scope grant via an ancestor that is a scope anchor
      OR EXISTS (
        SELECT 1
        FROM submission_feature_closure c
        JOIN security_scope_anchor ssa ON ssa.anchor_submission_feature_id = c.target_submission_feature_id
        JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
        JOIN team t ON t.team_id = tss.team_id
          AND t.record_end_date IS NULL
        JOIN team_member tm ON tm.team_id = tss.team_id
          AND tm.system_user_id = ?  -- bound by caller
          AND tm.record_end_date IS NULL
        WHERE c.source_submission_feature_id = ${featureIdExpr}
          AND c.is_ancestor = true
      )
  )`;
}

/**
 * Builds a single security filter, applied per candidate feature, that checks:
 *   1. Unsecured — no ancestor has an active submission_feature_security row → visible
 *   2. Secured + granted — any ancestor is a scope anchor the user's team can reach → visible
 *   3. Secured + denied — secured but no matching scope anchor → filtered out
 *
 * For anonymous users (systemUserId is null), only unsecured features pass.
 *
 * Composes the closure-based read-path fragments above:
 * - `isEffectivelySecured` — a feature is "effectively secured" only when it or an
 *   ancestor has an active security rule AND the feature is past its `record_effective_date`,
 *   resolved via the precomputed closure ancestry subset.
 * - `isAccessibleToUser` — probes the same closure ancestry for a scope anchor the user's team
 *   can reach.
 *
 * Both fragments are indexed closure lookups (PK-served on `source_submission_feature_id`), not
 * per-row recursive parent walks. Callers have already narrowed features to a small candidate
 * set, so the filter applies a couple of cheap probes per candidate — cost is O(candidates),
 * not O(features in scope).
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

  // Authenticated: feature is unsecured OR user has team scope grant (indexed closure lookups)
  return knex.raw(`${isAccessibleToUser(submissionFeatureIdColumn)}`, [systemUserId]);
}
