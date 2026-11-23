import { Knex } from 'knex';

/**
 * Predicate for a current submission feature: published, not ended, and without a successor.
 *
 * A copy of `isSubmissionFeatureCurrent` in `api/src/repositories/sql-fragments.ts`, as it stood when this
 * migration was written. Migrations cannot import api code.
 *
 * @param {string} alias SQL alias for submission_feature.
 * @return {string} SQL predicate.
 */
const isCurrent = (alias: string): string =>
  `${alias}.record_effective_date <= now() AND (${alias}.record_end_date IS NULL OR now() < ${alias}.record_end_date) AND ${alias}.successor_submission_feature_id IS NULL`;

/**
 * Predicate for a submission feature whose closure has been built: its reflexive self-loop row exists.
 *
 * @param {string} alias SQL alias for submission_feature.
 * @return {string} SQL predicate.
 */
const hasClosureSelfLoop = (alias: string): string =>
  `EXISTS (
        SELECT 1
        FROM submission_feature_closure closure_ready
        WHERE closure_ready.source_submission_feature_id = ${alias}.submission_feature_id
          AND closure_ready.target_submission_feature_id = ${alias}.submission_feature_id
      )`;

/**
 * Predicate for a feature that is effectively secured: it or a closure ancestor has an enforcing security
 * assignment, or its closure is missing (fail closed).
 *
 * A copy of `isEffectivelySecured` in `api/src/repositories/sql-fragments.ts`, as it stood when this migration
 * was written.
 *
 * @param {string} featureIdExpr SQL expression for the submission_feature_id.
 * @return {string} SQL predicate.
 */
const isEffectivelySecured = (featureIdExpr: string): string =>
  `(
        EXISTS (
          SELECT 1
          FROM submission_feature_closure c
          JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
          WHERE c.source_submission_feature_id = ${featureIdExpr}
            AND c.is_ancestor = true
            AND sfs.record_effective_date <= now()
            AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
        )
        OR NOT EXISTS (
          SELECT 1
          FROM submission_feature_closure c
          WHERE c.source_submission_feature_id = ${featureIdExpr}
            AND c.target_submission_feature_id = ${featureIdExpr}
        )
      )`;

/**
 * Predicate for a feature that matches the scope's URN pattern (`ss` is the security_scope being updated).
 *
 * @param {string} featureAlias SQL alias for submission_feature.
 * @param {string} featureTypeAlias SQL alias for feature_type.
 * @return {string} SQL predicate.
 */
const matchesScopeUrn = (featureAlias: string, featureTypeAlias: string): string =>
  `(ss.urn_submission_id = ${featureAlias}.submission_id::text OR ss.urn_submission_id = '*')
      AND (ss.urn_feature_type = ${featureTypeAlias}.name OR ss.urn_feature_type = '*')
      AND (ss.urn_feature_id = ${featureAlias}.submission_feature_id::text OR ss.urn_feature_id = '*')`;

/**
 * The active-approved-ALLOW test of `SecurityScopeRepository.resolveUrnForScope` in the api: the scope `ss` is
 * referenced by an active allow statement of an active approved policy.
 */
const HAS_ACTIVE_APPROVED_ALLOW_STATEMENT = `EXISTS (
        SELECT 1
        FROM policy_statement ps
        JOIN policy p ON p.policy_id = ps.policy_id
        WHERE ps.security_scope_id = ss.security_scope_id
          AND ps.record_end_date IS NULL
          AND ps.effect = 'allow'
          AND p.record_end_date IS NULL
          AND p.status = 'approved'
      )`;

/**
 * Build the UPDATE that sets `feature_ids` for one scope, whose id is the statement's single binding.
 *
 * The anchor rules mirror `SecurityScopeRepository.computeAnchorBatch` in the api: an anchor is a current,
 * closure-built, effectively secured feature matching the scope's URN, with no proper closure ancestor that
 * matches the URN and is effectively secured (the ancestor's own lifecycle is not checked). The bitmap holds each
 * anchor and its closure descendants that are current and closure-built, of any feature type.
 *
 * The scope is written only while it is still referenced by an active ALLOW statement of an active approved
 * policy; a qualifying scope that covers no feature gets an empty bitmap, not NULL.
 *
 * @param {string} anchorSubmissionPredicate Extra predicate on `anchor`, or an empty string.
 * @return {string} SQL statement with one binding: the security_scope_id.
 */
const backfillStatement = (anchorSubmissionPredicate: string): string => `
    UPDATE security_scope ss
    SET feature_ids = rb_runoptimize(COALESCE((
      SELECT rb_build_agg(member.submission_feature_id)
      FROM submission_feature anchor
      JOIN feature_type anchor_ft ON anchor_ft.feature_type_id = anchor.feature_type_id
      JOIN submission_feature_closure reach
        ON reach.target_submission_feature_id = anchor.submission_feature_id
       AND reach.is_ancestor = true
      JOIN submission_feature member
        ON member.submission_feature_id = reach.source_submission_feature_id
      WHERE ${isCurrent('anchor')}
      AND ${hasClosureSelfLoop('anchor')}
      ${anchorSubmissionPredicate}
      AND ${matchesScopeUrn('anchor', 'anchor_ft')}
      AND ${isEffectivelySecured('anchor.submission_feature_id')}
      AND NOT EXISTS (
        SELECT 1
        FROM submission_feature_closure ancestry
        JOIN submission_feature ancestor
          ON ancestor.submission_feature_id = ancestry.target_submission_feature_id
        JOIN feature_type ancestor_ft ON ancestor_ft.feature_type_id = ancestor.feature_type_id
        WHERE ancestry.source_submission_feature_id = anchor.submission_feature_id
          AND ancestry.target_submission_feature_id <> anchor.submission_feature_id
          AND ancestry.is_ancestor = true
          AND ${matchesScopeUrn('ancestor', 'ancestor_ft')}
          AND ${isEffectivelySecured('ancestor.submission_feature_id')}
      )
      AND ${isCurrent('member')}
      AND ${hasClosureSelfLoop('member')}
    ), rb_build('{}'::integer[])))
    WHERE ss.security_scope_id = ?
      AND ${HAS_ACTIVE_APPROVED_ALLOW_STATEMENT};
`;

/**
 * Run this migration outside a transaction.
 *
 * Knex runs the whole pending batch in a single transaction when every migration in it uses one. The column add
 * in the previous migration takes an ACCESS EXCLUSIVE lock on `security_scope`, which every signed-in read joins,
 * so in a shared transaction that lock would be held until this backfill finished. Opting out releases it first.
 *
 * Side effect: every migration in the same pending batch as this one runs in its own transaction, rather than one
 * transaction for all of them.
 */
export const config = { transaction: false };

/**
 * Backfill `security_scope.feature_ids` for every scope with an active approved ALLOW statement.
 *
 * Runs outside a transaction (see {@link config}), after the column add has committed and released its lock.
 *
 * The qualifying scope ids are read first (one uuid per scope), then each scope is built by its own UPDATE in its
 * own short transaction. One statement over every scope would be bounded by table size times scope count, would
 * hold one snapshot for all of it, and would commit nothing until the end. Per scope, each statement's work is
 * bounded by what that scope covers, it locks only that scope's row (which blocks no reader), and it commits when
 * it finishes. The backfill is idempotent: every statement recomputes its scope from current data, so a failure
 * part-way keeps the column and the scopes already done, and a re-run completes the rest.
 *
 * A scope naming a submission scans only that submission's features. The cast of `urn_submission_id` is safe: the
 * `security_scope_urn_validation` trigger casts every non-`*` submission id to integer and requires that
 * submission to exist. Updating `feature_ids` alone fires no trigger. Scopes without an active approved ALLOW
 * statement stay NULL.
 *
 * Each step runs in a transaction of its own so that the search path and the statement share one pooled
 * connection.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  const scopes = await knex.transaction(async (trx) => {
    await trx.raw(`SET LOCAL SEARCH_PATH = biohub, public;`);

    const result = await trx.raw<{ rows: { security_scope_id: string; is_any_submission: boolean }[] }>(`--sql
      SELECT ss.security_scope_id, ss.urn_submission_id = '*' AS is_any_submission
      FROM security_scope ss
      WHERE ${HAS_ACTIVE_APPROVED_ALLOW_STATEMENT}
      ORDER BY ss.security_scope_id;
    `);

    return result.rows;
  });

  const anySubmissionStatement = backfillStatement('');
  const oneSubmissionStatement = backfillStatement('AND anchor.submission_id = ss.urn_submission_id::integer');

  for (const scope of scopes) {
    await knex.transaction(async (trx) => {
      await trx.raw(`SET LOCAL SEARCH_PATH = biohub, public;`);

      await trx.raw(scope.is_any_submission ? anySubmissionStatement : oneSubmissionStatement, [
        scope.security_scope_id
      ]);
    });
  }
}

/**
 * Clear every backfilled bitmap.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    UPDATE security_scope SET feature_ids = NULL WHERE feature_ids IS NOT NULL;
  `);
}
