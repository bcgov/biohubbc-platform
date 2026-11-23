import { Knex } from 'knex';

/**
 * Add the `feature_ids` roaring bitmap column to `security_scope`.
 *
 * Each scope will store the set of `submission_feature_id` values it grants, so a later change can check access
 * by set membership instead of walking closure ancestry to an anchor. This migration is schema only: `ADD COLUMN`
 * takes an ACCESS EXCLUSIVE lock on `security_scope`, which every signed-in read joins, so it must commit quickly.
 * The backfill of existing scopes is the next migration, which opts out of transactions: knex would otherwise run
 * the whole pending batch in one transaction and hold this lock until the backfill finished.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE EXTENSION IF NOT EXISTS roaringbitmap WITH SCHEMA public;

    ALTER TABLE security_scope ADD COLUMN feature_ids roaringbitmap;

    COMMENT ON COLUMN security_scope.feature_ids IS
      'Run-optimised roaring bitmap of the submission_feature_id values this scope grants: its anchors and their available (current, closure-built) descendants. Derived from policy, security and closure data. NULL when it has never been built.';
  `);
}

/**
 * Drop the `feature_ids` column. The roaringbitmap extension stays installed: other objects may come to use it.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE security_scope DROP COLUMN IF EXISTS feature_ids;
  `);
}
