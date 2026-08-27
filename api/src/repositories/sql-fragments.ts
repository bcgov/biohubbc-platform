/**
 * Reusable SQL fragment builders for repository queries.
 *
 * These return raw SQL strings intended for interpolation into larger queries.
 * They are NOT parameterized — callers must only pass trusted column references
 * (e.g. 'sf.submission_feature_id'), never user input.
 */

import { Knex } from 'knex';

/**
 * Active-window predicate for submission_feature rows that may surface on read
 * paths or participate in access evaluation.
 *
 * A feature is active only after approval/publication sets record_effective_date
 * and before any end date. NULL record_effective_date rows are drafts/pending
 * review and must not be searchable, downloadable, or security anchors.
 *
 * @param alias SQL alias for submission_feature.
 * @returns SQL predicate with zero placeholders.
 */
export function isSubmissionFeatureActive(alias: string): string {
  return `${alias}.record_effective_date <= now() AND (${alias}.record_end_date IS NULL OR now() < ${alias}.record_end_date)`;
}

/**
 * Closure-based "effectively secured" check used on every security-resolving path —
 * the hot read paths (search / download) and the scope-anchor recompute write
 * path: a feature is effectively secured when it or an ancestor has an active security
 * rule that is past its effective date.
 *
 * Instead of a per-row recursive parent walk, this reads the precomputed
 * `submission_feature_closure` ancestry subset — `is_ancestor = true`, which is the
 * pure parent-ancestry reach including the feature's own self-loop `(F, F)` — joined
 * to the security tables. The ancestry lookup is served by the closure primary key on
 * `source_submission_feature_id`; the security joins are index-served on
 * `target_submission_feature_id`. This matters because it runs on every search
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
        AND ${isSubmissionFeatureActive('sf_sec')}
    )
    -- Fail closed: the reflexive self-loop (F, F) is written for every non-deleted feature when its upload's
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
 * 2. The caller's team holds a scope anchored on this feature or one of its ancestors
 *    (`security_scope_anchor` reachable via the caller's `team_member`).
 *
 * Returns an `EXISTS (...)` SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * This reads the precomputed `submission_feature_closure` ancestry subset
 * (`is_ancestor = true`, which includes the feature's own self-loop) instead of doing a
 * recursive parent walk. Branch 1 reuses `isEffectivelySecured`; Branch 2 probes the closure
 * for an ancestor that is a scope anchor the user's team can reach. Both are cheap PK-served
 * closure probes (`source_submission_feature_id`), so the old concern of walking the ancestor
 * chain twice no longer applies — there is no recursive walk at all.
 *
 * Note: a caller that has already established the feature is effectively secured (e.g. the
 * hidden-secured probe) still passes the whole expression here — Branch 1 then re-evaluates
 * `isEffectivelySecured` (a couple of indexed PK probes) and short-circuits to Branch 2. The cost
 * is small, and using the canonical check keeps the probe consistent with the visible-results filter.
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
      -- Branch 2: the caller's team holds a scope anchored on this feature or one of its ancestors
      OR EXISTS (
        SELECT 1
        FROM submission_feature_closure c
        JOIN security_scope_anchor ssa ON ssa.anchor_submission_feature_id = c.target_submission_feature_id
        JOIN security_scope ss ON ss.security_scope_id = ssa.security_scope_id
        JOIN submission_feature anchor_sf
          ON anchor_sf.submission_feature_id = ssa.anchor_submission_feature_id
          AND ${isSubmissionFeatureActive('anchor_sf')}
        JOIN feature_type anchor_ft ON anchor_ft.feature_type_id = anchor_sf.feature_type_id
        JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
        JOIN team t ON t.team_id = tss.team_id
          AND t.record_end_date IS NULL
        JOIN team_member tm ON tm.team_id = tss.team_id
          AND tm.system_user_id = ?  -- bound by caller
          AND tm.record_end_date IS NULL
        WHERE c.source_submission_feature_id = ${featureIdExpr}
          AND c.is_ancestor = true
          -- Anchors are an asynchronous cache. Revalidate the security- and scope-sensitive facts
          -- whose revocation must take effect immediately instead of trusting a stale cache row.
          AND EXISTS (
            SELECT 1
            FROM submission_feature_closure closure_ready
            WHERE closure_ready.source_submission_feature_id = anchor_sf.submission_feature_id
              AND closure_ready.target_submission_feature_id = anchor_sf.submission_feature_id
          )
          AND ${isEffectivelySecured('anchor_sf.submission_feature_id')}
          AND (ss.urn_submission_id = anchor_sf.submission_id::text OR ss.urn_submission_id = '*')
          AND (ss.urn_feature_type = anchor_ft.name OR ss.urn_feature_type = '*')
          AND (ss.urn_feature_id = anchor_sf.submission_feature_id::text OR ss.urn_feature_id = '*')
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

/**
 * Structured value for a taxon-valued submitted property, built from a `taxon` row.
 *
 * The object is the read-model shape returned for taxon references by every indexed-property
 * read path (search result rows and the feature-detail properties list), so the label, the
 * identifiers and their precedence are defined once here:
 * - `taxon_id` — BioHub surrogate key, the link target for the UI
 * - `tsn` — ITIS TSN
 * - `rank` — ITIS rank (nullable), used by the UI to format scientific-name style labels
 * - `label` — display text: the ITIS scientific name, which `taxon` stores NOT NULL
 *
 * Returns a `jsonb_build_object(...)` expression with zero placeholders.
 *
 * @param alias SQL alias for the joined `taxon` row (e.g. 't').
 * @returns SQL expression producing the taxon value object.
 */
export function taxonPropertyValueJson(alias: string): string {
  return `jsonb_build_object(
    'taxon_id', ${alias}.taxon_id,
    'tsn', ${alias}.itis_tsn,
    'rank', ${alias}.rank,
    'label', ${alias}.itis_scientific_name
  )`;
}
