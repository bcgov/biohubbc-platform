import type { Knex } from 'knex';

/**
 * Adds `download_version.feature_ids` — the set of features the version contains, as a roaring
 * bitmap of `submission_feature_id` values — and drops the `journal_download_version` trigger.
 *
 * The set is written once during the build, before any file is written, so the version's files,
 * its feature count and its feature list all come from the same set. Nullable with no default:
 * versions built before the column existed stay NULL, and nothing is backfilled.
 *
 * `tr_journal_trigger` is an AFTER trigger that copies the full old and new row into `audit_log` on
 * every insert, update, and delete. With a bitmap on the row, every status transition of a version
 * would copy the whole bitmap as hex text, twice (about 4 MB per copy for a million scattered ids).
 * Only the journal trigger is dropped: `audit_download_version` stays, so `create_user`,
 * `update_user`, `update_date` and the `revision_count` check behave as before.
 *
 * The `roaringbitmap` extension is installed by `20261123120000_security_scope_feature_ids.ts`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_version ADD COLUMN feature_ids roaringbitmap;

    COMMENT ON COLUMN download_version.feature_ids IS 'Run-optimised roaring bitmap of the submission_feature_id values this version contains. Written once during the build, before any file is written, and never changed afterwards; NULL for versions built before the column existed.';

    -- The journal copies the whole row, bitmap included, into audit_log on every write.
    DROP TRIGGER journal_download_version ON download_version;
  `);
}

/**
 * Reverses {@link up}: restores the journal trigger and drops the column.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TRIGGER journal_download_version
      AFTER INSERT OR UPDATE OR DELETE ON download_version
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    ALTER TABLE download_version DROP COLUMN IF EXISTS feature_ids;
  `);
}
