import { Knex } from 'knex';

/**
 * Adds `submission.default_blueprint_id`: the Blueprint a submission's future uploads are pinned to when the upload
 * request does not name one.
 *
 * `submission_upload.blueprint_id` remains the record of the Blueprint each upload was actually indexed with. Until
 * now a new upload inherited the Blueprint of the submission's most recent upload, so existing submissions are
 * backfilled with that Blueprint to preserve their current behaviour. A submission without uploads is left null and
 * falls back to the system default Blueprint.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission ADD COLUMN default_blueprint_id integer;

    COMMENT ON COLUMN submission.default_blueprint_id IS 'Foreign key to the blueprint that new uploads of this submission use when the upload request does not name one. Applies even after the blueprint is retired. Null falls back to the system default blueprint.';

    ALTER TABLE submission ADD CONSTRAINT submission_default_blueprint_fk
      FOREIGN KEY (default_blueprint_id) REFERENCES blueprint(blueprint_id);

    -- Backfill from each submission's most recent upload, including soft-deleted uploads, matching prior resolution.
    UPDATE submission s
    SET default_blueprint_id = latest_upload.blueprint_id
    FROM (
      SELECT DISTINCT ON (su.submission_id)
        su.submission_id,
        su.blueprint_id
      FROM submission_upload su
      ORDER BY su.submission_id, su.create_date DESC, su.submission_upload_id DESC
    ) latest_upload
    WHERE latest_upload.submission_id = s.submission_id;
  `);
}

/**
 * Reverses {@link up}: drops the foreign key and column.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission DROP CONSTRAINT IF EXISTS submission_default_blueprint_fk;

    ALTER TABLE submission DROP COLUMN IF EXISTS default_blueprint_id;
  `);
}
