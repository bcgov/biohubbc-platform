import { Knex } from 'knex';

/**
 * Adds `download_version.feature_count` — the total number of features materialized into the
 * version's artifacts, summed across all feature types.
 *
 * The count is written by the parquet pipeline when the version transitions to ready. Storing it
 * at materialization time means public reads never compute a live COUNT over the policy scope.
 * Nullable: versions materialized before counting existed stay NULL.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_version ADD COLUMN feature_count integer;

    COMMENT ON COLUMN download_version.feature_count IS 'Total number of features materialized into this version''s artifacts, summed across all feature types. Written when the version transitions to ready; NULL for versions materialized before counting existed. Stored at materialization time so public reads never compute a live COUNT over the policy scope.';
  `);
}

/**
 * Reverses {@link up}: drops the column.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_version DROP COLUMN IF EXISTS feature_count;
  `);
}
