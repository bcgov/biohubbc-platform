import { Knex } from 'knex';

/**
 * Adds `security_scope.feature_ids`: the set of `submission_feature_id` values a scope grants, stored as a roaring
 * bitmap, and backfills it for existing scopes.
 *
 * A later change can then check access by set membership instead of walking closure ancestry to an anchor. Scopes
 * referenced by an active allow statement of an active approved policy are backfilled; a scope that covers no
 * feature gets an empty bitmap, and every other scope is left null.
 *
 * The backfill runs in the same transaction as the column add, so `security_scope` is locked against reads until
 * it finishes. Time this migration on a production-sized copy before release.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Install the roaring bitmap type and functions.
    ----------------------------------------------------------------------------------------
    CREATE EXTENSION IF NOT EXISTS roaringbitmap WITH SCHEMA public;

    ----------------------------------------------------------------------------------------
    -- 2. Add the nullable bitmap column.
    ----------------------------------------------------------------------------------------
    ALTER TABLE security_scope ADD COLUMN feature_ids roaringbitmap;

    COMMENT ON COLUMN security_scope.feature_ids IS 'Run-optimised roaring bitmap of the submission_feature_id values this scope grants: its anchors and their available (current, closure-built) descendants. Derived from policy, security and closure data. NULL when it has never been built.';

    ----------------------------------------------------------------------------------------
    -- 3. Backfill existing scopes (steps 4 and 5).
    --
    -- A scope's bitmap holds its anchors and their available descendants of any feature type.
    -- The anchor rules mirror SecurityScopeRepository.computeAnchorBatch in the api; they are
    -- copied here because a migration cannot import api code.
    --
    -- The backfill is two statements so that a scope naming a submission reads only that
    -- submission's features, through the (submission_id, submission_feature_id) index. They
    -- differ only in that predicate and in which scopes they update.
    --
    -- Only scopes with an active allow statement of an active approved policy are written.
    -- Updating feature_ids alone fires no trigger.
    ----------------------------------------------------------------------------------------

    ----------------------------------------------------------------------------------------
    -- 4. Backfill the scopes that name a submission.
    ----------------------------------------------------------------------------------------
    UPDATE security_scope ss
    SET feature_ids = rb_runoptimize(COALESCE((
      SELECT rb_build_agg(member.submission_feature_id)
      FROM submission_feature anchor
      JOIN feature_type anchor_ft ON anchor_ft.feature_type_id = anchor.feature_type_id
      -- Every feature the anchor reaches down to, including the anchor through its own self-loop.
      JOIN submission_feature_closure reach
        ON reach.target_submission_feature_id = anchor.submission_feature_id
       AND reach.is_ancestor = true
      JOIN submission_feature member
        ON member.submission_feature_id = reach.source_submission_feature_id
      WHERE
        -- The anchor is current: published, not ended, and without a successor.
        anchor.record_effective_date <= now()
        AND (anchor.record_end_date IS NULL OR now() < anchor.record_end_date)
        AND anchor.successor_submission_feature_id IS NULL
        -- The anchor's closure is built.
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure closure_ready
          WHERE closure_ready.source_submission_feature_id = anchor.submission_feature_id
            AND closure_ready.target_submission_feature_id = anchor.submission_feature_id
        )
        -- Read only the scope's own submission. The cast is safe: the security_scope_urn_validation trigger
        -- casts every non-* submission id to integer.
        AND anchor.submission_id = ss.urn_submission_id::integer
        -- The anchor matches the scope's URN.
        AND (ss.urn_submission_id = anchor.submission_id::text OR ss.urn_submission_id = '*')
        AND (ss.urn_feature_type = anchor_ft.name OR ss.urn_feature_type = '*')
        AND (ss.urn_feature_id = anchor.submission_feature_id::text OR ss.urn_feature_id = '*')
        -- The anchor is effectively secured: it or a closure ancestor has an enforcing security assignment,
        -- or its closure is missing (fail closed).
        AND (
          EXISTS (
            SELECT 1
            FROM submission_feature_closure c
            JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
            WHERE c.source_submission_feature_id = anchor.submission_feature_id
              AND c.is_ancestor = true
              AND sfs.record_effective_date <= now()
              AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
          )
          OR NOT EXISTS (
            SELECT 1
            FROM submission_feature_closure c
            WHERE c.source_submission_feature_id = anchor.submission_feature_id
              AND c.target_submission_feature_id = anchor.submission_feature_id
          )
        )
        -- No proper ancestor also matches the URN and is effectively secured, so the anchor is the topmost
        -- match. The ancestor's own lifecycle is deliberately not checked.
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_closure ancestry
          JOIN submission_feature ancestor
            ON ancestor.submission_feature_id = ancestry.target_submission_feature_id
          JOIN feature_type ancestor_ft ON ancestor_ft.feature_type_id = ancestor.feature_type_id
          WHERE ancestry.source_submission_feature_id = anchor.submission_feature_id
            AND ancestry.target_submission_feature_id <> anchor.submission_feature_id
            AND ancestry.is_ancestor = true
            AND (ss.urn_submission_id = ancestor.submission_id::text OR ss.urn_submission_id = '*')
            AND (ss.urn_feature_type = ancestor_ft.name OR ss.urn_feature_type = '*')
            AND (ss.urn_feature_id = ancestor.submission_feature_id::text OR ss.urn_feature_id = '*')
            AND (
              EXISTS (
                SELECT 1
                FROM submission_feature_closure c
                JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
                WHERE c.source_submission_feature_id = ancestor.submission_feature_id
                  AND c.is_ancestor = true
                  AND sfs.record_effective_date <= now()
                  AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
              )
              OR NOT EXISTS (
                SELECT 1
                FROM submission_feature_closure c
                WHERE c.source_submission_feature_id = ancestor.submission_feature_id
                  AND c.target_submission_feature_id = ancestor.submission_feature_id
              )
            )
        )
        -- The member is available: current, with its closure built.
        AND member.record_effective_date <= now()
        AND (member.record_end_date IS NULL OR now() < member.record_end_date)
        AND member.successor_submission_feature_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure closure_ready
          WHERE closure_ready.source_submission_feature_id = member.submission_feature_id
            AND closure_ready.target_submission_feature_id = member.submission_feature_id
        )
    ), rb_build('{}'::integer[])))
    WHERE ss.urn_submission_id <> '*'
      AND EXISTS (
        SELECT 1
        FROM policy_statement ps
        JOIN policy p ON p.policy_id = ps.policy_id
        WHERE ps.security_scope_id = ss.security_scope_id
          AND ps.record_end_date IS NULL
          AND ps.effect = 'allow'
          AND p.record_end_date IS NULL
          AND p.status = 'approved'
      );

    ----------------------------------------------------------------------------------------
    -- 5. Backfill the scopes that cover every submission.
    ----------------------------------------------------------------------------------------
    UPDATE security_scope ss
    SET feature_ids = rb_runoptimize(COALESCE((
      SELECT rb_build_agg(member.submission_feature_id)
      FROM submission_feature anchor
      JOIN feature_type anchor_ft ON anchor_ft.feature_type_id = anchor.feature_type_id
      -- Every feature the anchor reaches down to, including the anchor through its own self-loop.
      JOIN submission_feature_closure reach
        ON reach.target_submission_feature_id = anchor.submission_feature_id
       AND reach.is_ancestor = true
      JOIN submission_feature member
        ON member.submission_feature_id = reach.source_submission_feature_id
      WHERE
        -- The anchor is current: published, not ended, and without a successor.
        anchor.record_effective_date <= now()
        AND (anchor.record_end_date IS NULL OR now() < anchor.record_end_date)
        AND anchor.successor_submission_feature_id IS NULL
        -- The anchor's closure is built.
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure closure_ready
          WHERE closure_ready.source_submission_feature_id = anchor.submission_feature_id
            AND closure_ready.target_submission_feature_id = anchor.submission_feature_id
        )
        -- The anchor matches the scope's URN.
        AND (ss.urn_submission_id = anchor.submission_id::text OR ss.urn_submission_id = '*')
        AND (ss.urn_feature_type = anchor_ft.name OR ss.urn_feature_type = '*')
        AND (ss.urn_feature_id = anchor.submission_feature_id::text OR ss.urn_feature_id = '*')
        -- The anchor is effectively secured: it or a closure ancestor has an enforcing security assignment,
        -- or its closure is missing (fail closed).
        AND (
          EXISTS (
            SELECT 1
            FROM submission_feature_closure c
            JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
            WHERE c.source_submission_feature_id = anchor.submission_feature_id
              AND c.is_ancestor = true
              AND sfs.record_effective_date <= now()
              AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
          )
          OR NOT EXISTS (
            SELECT 1
            FROM submission_feature_closure c
            WHERE c.source_submission_feature_id = anchor.submission_feature_id
              AND c.target_submission_feature_id = anchor.submission_feature_id
          )
        )
        -- No proper ancestor also matches the URN and is effectively secured, so the anchor is the topmost
        -- match. The ancestor's own lifecycle is deliberately not checked.
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_closure ancestry
          JOIN submission_feature ancestor
            ON ancestor.submission_feature_id = ancestry.target_submission_feature_id
          JOIN feature_type ancestor_ft ON ancestor_ft.feature_type_id = ancestor.feature_type_id
          WHERE ancestry.source_submission_feature_id = anchor.submission_feature_id
            AND ancestry.target_submission_feature_id <> anchor.submission_feature_id
            AND ancestry.is_ancestor = true
            AND (ss.urn_submission_id = ancestor.submission_id::text OR ss.urn_submission_id = '*')
            AND (ss.urn_feature_type = ancestor_ft.name OR ss.urn_feature_type = '*')
            AND (ss.urn_feature_id = ancestor.submission_feature_id::text OR ss.urn_feature_id = '*')
            AND (
              EXISTS (
                SELECT 1
                FROM submission_feature_closure c
                JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
                WHERE c.source_submission_feature_id = ancestor.submission_feature_id
                  AND c.is_ancestor = true
                  AND sfs.record_effective_date <= now()
                  AND (sfs.record_end_date IS NULL OR now() < sfs.record_end_date)
              )
              OR NOT EXISTS (
                SELECT 1
                FROM submission_feature_closure c
                WHERE c.source_submission_feature_id = ancestor.submission_feature_id
                  AND c.target_submission_feature_id = ancestor.submission_feature_id
              )
            )
        )
        -- The member is available: current, with its closure built.
        AND member.record_effective_date <= now()
        AND (member.record_end_date IS NULL OR now() < member.record_end_date)
        AND member.successor_submission_feature_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM submission_feature_closure closure_ready
          WHERE closure_ready.source_submission_feature_id = member.submission_feature_id
            AND closure_ready.target_submission_feature_id = member.submission_feature_id
        )
    ), rb_build('{}'::integer[])))
    WHERE ss.urn_submission_id = '*'
      AND EXISTS (
        SELECT 1
        FROM policy_statement ps
        JOIN policy p ON p.policy_id = ps.policy_id
        WHERE ps.security_scope_id = ss.security_scope_id
          AND ps.record_end_date IS NULL
          AND ps.effect = 'allow'
          AND p.record_end_date IS NULL
          AND p.status = 'approved'
      );
  `);
}

/**
 * Reverses {@link up}: drops the column. The roaringbitmap extension stays installed, as other objects may come to
 * use it.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE security_scope DROP COLUMN IF EXISTS feature_ids;
  `);
}
