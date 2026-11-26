/**
 * Reusable SQL fragment builders for repository queries.
 *
 * These return raw SQL strings intended for interpolation into larger queries.
 * They are NOT parameterized — callers must only pass trusted column references
 * (e.g. 'sf.submission_feature_id'), never user input.
 */

import { Knex } from 'knex';

/**
 * Predicate for a submission_feature row that has been published at least once.
 *
 * For submission features, `record_effective_date` is the publication date: approval sets it,
 * and NULL identifies a draft that has never been published. Superseding a feature does not
 * clear its publication date, so previously published features remain available to direct-ID reads.
 *
 * @param alias SQL alias for submission_feature.
 * @returns SQL predicate with zero placeholders.
 */
export function isSubmissionFeaturePublished(alias: string): string {
  return `${alias}.record_effective_date <= now()`;
}

/**
 * Predicate for a current feature: published, not ended, and without a successor.
 *
 * Lifecycle by read scope:
 * - Submission collection, search, and download paths use this predicate to exclude superseded features. The closure
 *   holds only current features, so a closure self-loop is an equivalent check.
 * - Direct ID lookups use {@link isSubmissionFeaturePublished} instead so previously published features remain
 *   accessible.
 * - Upload-scoped reads apply no lifecycle predicate: every feature of an upload is viewable, including unpublished,
 *   ended, and superseded features.
 *
 * @param alias SQL alias for submission_feature.
 * @returns SQL predicate with zero placeholders.
 */
export function isSubmissionFeatureCurrent(alias: string): string {
  return `${isSubmissionFeaturePublished(
    alias
  )} AND (${alias}.record_end_date IS NULL OR now() < ${alias}.record_end_date) AND ${alias}.successor_submission_feature_id IS NULL`;
}

/**
 * Parent source id of a submission_feature row, read from its submitted payload. Empty strings mean no parent.
 *
 * @param alias SQL alias for submission_feature.
 * @returns SQL expression with zero placeholders.
 */
export function submissionFeatureParentSourceId(alias: string): string {
  return `NULLIF(${alias}.data->>'parent', '')`;
}

/**
 * Resolve a pending upload feature's parent source id to a parent submission_feature_id.
 *
 * Prefers a pending row from the child's own upload, falling back to the submission's current
 * published rows. Ties resolve to the newest row. Returns NULL when no parent matches.
 *
 * @param childAlias SQL alias for the child submission_feature row.
 * @returns Scalar subquery SQL with zero placeholders.
 */
export function resolveSubmissionFeatureParentId(childAlias: string): string {
  return `(
    SELECT parent.submission_feature_id
    FROM submission_feature AS parent
    WHERE parent.submission_id = ${childAlias}.submission_id
      AND parent.source_id = ${submissionFeatureParentSourceId(childAlias)}
      AND (
        (
          parent.submission_upload_id = ${childAlias}.submission_upload_id
          AND parent.record_effective_date IS NULL
          AND parent.record_end_date IS NULL
        )
        OR (${isSubmissionFeatureCurrent('parent')})
      )
    ORDER BY
      (parent.submission_upload_id = ${childAlias}.submission_upload_id) DESC,
      parent.submission_feature_id DESC
    LIMIT 1
  )`;
}

/**
 * Resolve a submission_feature row to its same-submission terminal current feature.
 *
 * This follows only `successor_submission_feature_id`, rejects cross-submission successor hops,
 * terminates safely on cycles, and returns no row unless the terminal feature is published, not
 * ended, and without a successor. The recursive projection contains only stable feature state, so
 * `UNION` naturally terminates a
 * malformed cycle without carrying and repeatedly copying a path array.
 *
 * @param submissionFeatureId Trusted SQL expression for the starting submission feature ID.
 * @returns Lateral subquery SQL with one `terminal_submission_feature_id` column and zero placeholders.
 */
export function buildSubmissionFeatureTerminalSubquery(submissionFeatureId: string): string {
  return `(WITH RECURSIVE successor_chain AS (
    SELECT
      source.submission_feature_id,
      source.submission_id,
      source.successor_submission_feature_id,
      source.record_effective_date,
      source.record_end_date
    FROM submission_feature source
    WHERE source.submission_feature_id = ${submissionFeatureId}

    UNION

    SELECT
      successor.submission_feature_id,
      successor.submission_id,
      successor.successor_submission_feature_id,
      successor.record_effective_date,
      successor.record_end_date
    FROM successor_chain chain
    JOIN submission_feature successor
      ON successor.submission_feature_id = chain.successor_submission_feature_id
     AND successor.submission_id = chain.submission_id
  )
  SELECT chain.submission_feature_id AS terminal_submission_feature_id
  FROM successor_chain chain
  WHERE ${isSubmissionFeatureCurrent('chain')}
  LIMIT 1)`;
}

/**
 * Closure-based "effectively secured" check used on every security-resolving path —
 * the hot read paths (search / download) and the scope-anchor recompute write
 * path: a feature is effectively secured when it or an ancestor in the materialized closure
 * snapshot has a currently enforcing security assignment.
 *
 * Instead of a per-row recursive parent walk, this reads the precomputed
 * `submission_feature_closure` ancestry subset — `is_ancestor = true`, which is the
 * pure parent-ancestry reach including the feature's own self-loop `(F, F)` — joined
 * to the security tables. The ancestry lookup is served by the closure primary key on
 * `source_submission_feature_id`; the security joins are index-served on
 * `target_submission_feature_id`. This matters because it runs on every search
 * and download request.
 *
 * IMPORTANT: closure targets are intentionally NOT filtered through
 * `isSubmissionFeatureCurrent`. A closure is a materialized graph snapshot, so every target in
 * that snapshot remains an ancestor for authorization purposes even if the corresponding
 * `submission_feature` becomes historical before the next closure rebuild.
 *
 * This is essential during successor publication. For example, the current closure may contain
 * `child -> parent_v1` while approval atomically ends `parent_v1` and makes `parent_v2` current.
 * Until the asynchronous closure worker rewrites that edge to `child -> parent_v2`, requiring
 * `parent_v1` to remain current would combine the old graph snapshot with the new feature lifecycle.
 * Its enforcing security would appear to disappear from the child even though the closure still
 * identifies it as the child's parent. Because the child's `(child, child)` self-loop still exists,
 * the missing-closure fail-closed guard below would not detect this mixed-state gap.
 *
 * Therefore ancestor feature lifecycle is deliberately ignored here. The lifecycle of the
 * `submission_feature_security` assignment is NOT ignored: it must still be active, effective,
 * and non-ended. Callers remain responsible for applying `isSubmissionFeatureCurrent` to the
 * candidate feature being searched, downloaded, or returned; this exception applies only to
 * ancestor targets reached through the closure snapshot.
 *
 * Fails closed on missing closure rows. The closure is rebuilt asynchronously after feature
 * publication, in a separate transaction. A recompute that has not yet run, or that failed, does
 * not make the feature non-current. So a current, searchable, secured feature can transiently — or, on a
 * failed recompute, indefinitely — have no closure rows. Rather than read "no rows" as "unsecured"
 * (which would leak the feature), this check treats the absence of any closure ancestry row
 * as secured: if we cannot prove a feature is unsecured, we hide it. Under normal operation
 * every current feature carries at least its self-loop `(F, F)`, so the fail-closed branch is
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
      WHERE c.source_submission_feature_id = ${featureIdExpr}
        AND c.is_ancestor = true
        AND sfs.record_effective_date <= now()
        AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
    )
    -- Fail closed: the reflexive self-loop (F, F) is written for every current feature when the
    -- submission closure is built, so its absence means the closure is not built (recompute not yet run, or failed).
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
 * The union of the feature-id bitmaps of every scope the caller's active teams hold.
 *
 * The caller's scopes are reached through `team_member` -> `team` -> `team_security_scope`, with the end-date checks
 * on the membership and the team. A scope is read once however many of the caller's teams hold it.
 *
 * The subquery references no outer row, so PostgreSQL builds the union once per place the fragment appears in a
 * statement (an InitPlan), never once per candidate feature.
 *
 * `rb_or_agg` skips NULL bitmaps. The result is NULL when the caller holds no scope, or only scopes whose bitmap has
 * never been built.
 *
 * The fragment's aliases carry the `caller_` prefix so they cannot capture an alias of the query it is placed in.
 *
 * @returns Scalar subquery SQL (a `roaringbitmap`, or NULL) with a single `?` placeholder for `systemUserId`.
 */
export function callerGrantedFeatureIds(): string {
  return `(
    SELECT rb_or_agg(caller_scope.feature_ids)
    FROM security_scope caller_scope
    WHERE caller_scope.security_scope_id IN (
      SELECT caller_tss.security_scope_id
      FROM team_member caller_tm
      JOIN team caller_team
        ON caller_team.team_id = caller_tm.team_id
        AND caller_team.record_end_date IS NULL
      JOIN team_security_scope caller_tss ON caller_tss.team_id = caller_tm.team_id
      WHERE caller_tm.system_user_id = ?  -- bound by caller
        AND caller_tm.record_end_date IS NULL
    )
  )`;
}

/**
 * Combined security + scope-grant check for authenticated users on the read paths.
 * A feature is accessible when either:
 *
 * 1. The feature is NOT effectively secured (no enforcing security assignment in its closure ancestry), OR
 * 2. The feature's id is in the caller's bitmap union ({@link callerGrantedFeatureIds}) AND the feature has its
 *    closure self-loop.
 *
 * Returns a parenthesised boolean SQL expression with a single `?` placeholder for `systemUserId`.
 *
 * - The union is built once per place this fragment appears in a statement, not once per candidate.
 * - A NULL union (no scopes, or only scopes whose bitmap was never built) grants nothing.
 * - The self-loop probe keeps a granted feature whose closure is not built hidden. Not every reader probes the
 *   candidate's self-loop itself, so the check lives here. It is a primary-key probe.
 * - Callers remain responsible for limiting the candidate to current features (`isSubmissionFeatureCurrent`).
 *
 * A scope's bitmap (`security_scope.feature_ids`) is a computed cache, and this check trusts it: a bitmap hit is not
 * revalidated against anchors, rule assignments or scope URNs. An id that is stale in a bitmap therefore keeps granting
 * a current, self-looped feature until the bitmap is refreshed. The known case is a reload: an upload approval that
 * re-points a child to its parent's successor leaves the child's id in the bitmap until
 * `SecurityScopeService.refreshScopeFeatureBitmapForSubmission` runs. Losing a team membership, a team or a
 * team's scope takes effect on the next query, because those are read live to build the union.
 *
 * Note: a caller that has already established the feature is effectively secured (e.g. the
 * hidden-secured probe) still passes the whole expression here — Branch 1 then re-evaluates
 * `isEffectivelySecured` (a couple of indexed PK probes) and falls through to Branch 2. The cost
 * is small, and using the canonical check keeps the probe consistent with the visible-results filter.
 *
 * @param featureIdExpr SQL expression for the candidate submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'aggregated_results.submission_feature_id')
 */
export function isAccessibleToUser(featureIdExpr: string): string {
  return `(
    -- Branch 1: feature is NOT effectively secured
    NOT ${isEffectivelySecured(featureIdExpr)}
    -- Branch 2: the feature's id is in the caller's bitmap union, and the feature has its closure self-loop
    OR (
      COALESCE(rb_contains(${callerGrantedFeatureIds()}, ${featureIdExpr}), false)
      AND EXISTS (
        SELECT 1
        FROM submission_feature_closure granted_ready
        WHERE granted_ready.source_submission_feature_id = ${featureIdExpr}
          AND granted_ready.target_submission_feature_id = ${featureIdExpr}
      )
    )
  )`;
}

/**
 * Builds a single security filter, applied per candidate feature, that checks:
 *   1. Unsecured — no ancestor has an active submission_feature_security row → visible
 *   2. Secured + granted — the feature's id is in the bitmap union of the scopes the user's active teams hold,
 *      and the feature has its closure self-loop → visible
 *   3. Secured + denied — secured and not in the union (or the union is NULL) → filtered out
 *
 * For anonymous users (systemUserId is null), only unsecured features pass.
 *
 * Composes the read-path fragments above:
 * - `isEffectivelySecured` — a feature is "effectively secured" when it or an ancestor in the
 *   closure snapshot has a currently enforcing security assignment.
 * - `isAccessibleToUser` — tests the candidate's id against the caller's bitmap union.
 *
 * The union is built once per place the filter appears in a statement; each candidate then costs a couple of
 * primary-key closure probes and one in-memory bitmap test — cost is O(candidates), not O(features in scope)
 * and not O(scopes the caller holds).
 *
 * A bitmap is a computed cache the filter trusts; see `isAccessibleToUser` for what a stale id grants and until when.
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

  // Authenticated: feature is unsecured OR its id is in the caller's scope bitmap union
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

/**
 * Structured value for a code-valued submitted property, built from a `contributor_codeset_code` row
 * and its parent `contributor_codeset` row.
 *
 * The object is the read-model shape returned for code references by every indexed-property read
 * path (search result rows and the feature-detail properties list), so the label and the identifiers
 * are defined once here:
 * - `codeset_key` / `codeset_label` — the codeset the code belongs to (machine key, display label)
 * - `code_key` / `code_label` — the code itself (machine key, display label)
 * - `label` — display text: the code label
 *
 * Returns a `jsonb_build_object(...)` expression with zero placeholders.
 *
 * @param codeAlias SQL alias for the joined `contributor_codeset_code` row (e.g. 'ccc').
 * @param codesetAlias SQL alias for the joined `contributor_codeset` row (e.g. 'cs').
 * @returns SQL expression producing the code value object.
 */
export function codePropertyValueJson(codeAlias: string, codesetAlias: string): string {
  return `jsonb_build_object(
    'codeset_key', ${codesetAlias}.key,
    'codeset_label', ${codesetAlias}.label,
    'code_key', ${codeAlias}.key,
    'code_label', ${codeAlias}.label,
    'label', ${codeAlias}.label
  )`;
}

/**
 * Structured value for a feature-valued submitted property, built from the referenced
 * `submission_feature` row.
 *
 * The object is the read-model shape returned for feature references by every indexed-property read
 * path (search result rows and the feature-detail properties list):
 * - `urn` — the referenced feature's URN (`urn:<submission_id>:<feature_type_name>:<submission_feature_id>`),
 *   which identifies the feature a link targets
 * - `label` — display text: the URN
 *
 * Returns a `jsonb_build_object(...)` expression with zero placeholders.
 *
 * @param alias SQL alias for the joined referenced `submission_feature` row (e.g. 'referenced_sf').
 * @returns SQL expression producing the feature reference value object.
 */
export function featureReferencePropertyValueJson(alias: string): string {
  return `jsonb_build_object(
    'urn', ${alias}.urn,
    'label', ${alias}.urn
  )`;
}

/**
 * JSON array of a ticket's active tags, as `[{ tag_id, name, color }]` ordered by case-insensitive name.
 * Returns `[]` when the ticket has no active tags. Both the link and the tag must be active.
 *
 * @param ticketIdExpr Trusted SQL expression for the ticket identifier (e.g. 't.ticket_id').
 * @returns SQL scalar subquery with zero placeholders.
 */
export function activeTicketTagsJson(ticketIdExpr: string): string {
  return `
    COALESCE(
      (
        SELECT json_agg(
          json_build_object('tag_id', tag_summary.tag_id, 'name', tag_summary.name, 'color', tag_summary.color)
          ORDER BY lower(tag_summary.name), tag_summary.tag_id
        )
        FROM ticket_tag tag_link
        JOIN tag tag_summary
          ON tag_summary.tag_id = tag_link.tag_id
          AND tag_summary.record_end_date IS NULL
        WHERE tag_link.ticket_id = ${ticketIdExpr}
          AND tag_link.record_end_date IS NULL
      ),
      '[]'::json
    )
  `;
}
