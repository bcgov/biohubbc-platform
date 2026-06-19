import { Knex } from 'knex';

/**
 * Adds `submission_upload.blueprint_id` so each upload is pinned to the Blueprint it was created with.
 *
 * Indexing resolves feature properties through this stored Blueprint rather than re-selecting the
 * current default Blueprint, so existing uploads remain stable when the default Blueprint changes
 * later. Existing rows are backfilled with the active default Blueprint to preserve current behavior.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload ADD COLUMN blueprint_id integer;

    COMMENT ON COLUMN submission_upload.blueprint_id IS 'Foreign key to the blueprint used to index this upload. Pinned at upload creation so indexing is stable when the default Blueprint changes.';

    -- Backfill existing rows with the active default Blueprint, matching prior indexing behavior.
    UPDATE submission_upload su
    SET blueprint_id = b.blueprint_id
    FROM blueprint b
    WHERE su.blueprint_id IS NULL
      AND b.is_default = true
      AND b.record_end_date IS NULL;

    ALTER TABLE submission_upload ALTER COLUMN blueprint_id SET NOT NULL;

    ALTER TABLE submission_upload ADD CONSTRAINT submission_upload_blueprint_fk
      FOREIGN KEY (blueprint_id) REFERENCES blueprint(blueprint_id);

    CREATE INDEX submission_upload_blueprint_idx ON submission_upload(blueprint_id);
  `);
}

/**
 * Reverses {@link up}: drops the index, foreign key, and column.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_blueprint_idx;

    ALTER TABLE submission_upload DROP CONSTRAINT IF EXISTS submission_upload_blueprint_fk;

    ALTER TABLE submission_upload DROP COLUMN IF EXISTS blueprint_id;
  `);
}
