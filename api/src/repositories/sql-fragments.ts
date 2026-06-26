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
      OR ${hasTeamScopeAnchorGrant(featureIdExpr)}
  )`;
}

/**
 * Branch 2 of {@link isAccessibleToUser}, exposed on its own: the caller's team holds a scope anchored
 * on this feature or one of its ancestors. Reads the precomputed `submission_feature_closure` ancestry
 * subset (`is_ancestor = true`, which includes the feature's own self-loop) and joins through
 * `security_scope_anchor` → `team_security_scope` → the caller's `team_member`.
 *
 * Callers that have already established the feature is effectively secured (e.g. the hidden-secured
 * probe) can use this directly instead of {@link isAccessibleToUser} to avoid re-evaluating
 * `isEffectivelySecured` — for a secured feature, accessibility reduces to this grant check.
 *
 * Returns an `EXISTS (...)` SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'mf.submission_feature_id')
 */
export function hasTeamScopeAnchorGrant(featureIdExpr: string): string {
  return `EXISTS (
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
  )`;
}

/**
 * Direct URN-based scope grant check for the current caller, independent of
 * `security_scope_anchor` rows.
 *
 * `isAccessibleToUser` resolves grants via precomputed anchors on the closure read path.
 * A caller with a standing scope (e.g. `urn:*:*:*`) can match a secured feature by URN even
 * when anchor recomputation has not yet run for that feature. The hidden-secured-match probe
 * uses this to avoid raising `has_more_secured_features` for callers who already hold a policy
 * grant covering the feature, without requiring another team to hold an anchor first.
 *
 * Like `isEffectivelySecured` (and the anchor read path), security and the grants that cover it
 * cascade down the hierarchy: a grant that matches a feature's secured *ancestor* covers the feature
 * too. This matches the caller's scope URNs against the feature ITSELF or any of its
 * `submission_feature_closure` ancestors (`is_ancestor = true`). Checking only the feature's own URN
 * would miss a caller who holds, say, `urn:{sub}:dataset:*` while searching the telemetry/observation
 * features secured by that dataset — during the anchor-recompute lag window (`isAccessibleToUser`
 * still false) that gap would raise a false-positive banner for data the caller can actually access.
 *
 * The candidate set is `the feature itself UNION its closure ancestors`. The explicit self
 * (`SELECT ${featureIdExpr}`) is kept rather than relying solely on the closure self-loop, so a feature
 * whose closure has not been built yet (the fail-closed case `isEffectivelySecured` guards against) is
 * still resolvable by a grant on its own URN — otherwise a blanket-grant holder would see a
 * false-positive banner for it.
 *
 * Mirrors the URN join semantics in `TeamAuthorizationRepository.findTeamPolicyBySubmissionFeature`,
 * extended over the closure ancestry.
 *
 * Returns an `EXISTS (...)` SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'mf.submission_feature_id')
 */
export function isAccessibleViaDirectUrnScopeGrant(featureIdExpr: string): string {
  return `EXISTS (
    SELECT 1
    FROM team_member tm
    JOIN team t ON t.team_id = tm.team_id
      AND t.record_end_date IS NULL
    JOIN team_security_scope tss ON tss.team_id = t.team_id
    JOIN security_scope ss ON ss.security_scope_id = tss.security_scope_id
    JOIN policy_statement ps ON ps.security_scope_id = ss.security_scope_id
      AND ps.effect = 'allow'
      AND ps.record_end_date IS NULL
    JOIN policy p ON p.policy_id = ps.policy_id
      AND p.record_end_date IS NULL
      AND p.status = 'approved'
    JOIN submission_feature sf_grant
      ON sf_grant.submission_feature_id IN (
        SELECT ${featureIdExpr}
        UNION
        SELECT c.target_submission_feature_id
        FROM submission_feature_closure c
        WHERE c.source_submission_feature_id = ${featureIdExpr}
          AND c.is_ancestor = true
      )
    JOIN feature_type ft_grant ON ft_grant.feature_type_id = sf_grant.feature_type_id
    WHERE tm.system_user_id = ?
      AND tm.record_end_date IS NULL
      AND (ss.urn_submission_id = sf_grant.submission_id::text OR ss.urn_submission_id = '*')
      AND (ss.urn_feature_type = ft_grant.name OR ss.urn_feature_type = '*')
      AND (ss.urn_feature_id = sf_grant.submission_feature_id::text OR ss.urn_feature_id = '*')
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
