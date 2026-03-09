import { Knex } from 'knex';

/**
 * Replace submission_feature.upload_id (FK → upload) with submission_upload_id (FK → submission_upload).
 *
 * submission_upload_id is the processing identifier — it tracks which upload event
 * produced these features for a submission. This distinction enables multi-upload-per-submission
 * (append, replace) and eliminates the need to carry both uploadId and submissionId
 * through the pipeline.
 *
 * No backfill needed — no production data exists yet. Seeds provide correct values directly.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- 1. Drop old upload_id column, FK, and index
    ALTER TABLE submission_feature
      DROP CONSTRAINT IF EXISTS submission_feature_fk4;

    DROP INDEX IF EXISTS submission_feature_idx4;

    ALTER TABLE submission_feature
      DROP COLUMN upload_id;

    -- 2. Add new submission_upload_id column with FK → submission_upload
    ALTER TABLE submission_feature
      ADD COLUMN submission_upload_id uuid NOT NULL;

    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_fk4
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id);

    CREATE INDEX submission_feature_idx4
      ON submission_feature(submission_upload_id);

    COMMENT ON COLUMN submission_feature.submission_upload_id IS 'Foreign key to the submission_upload table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- 1. Drop submission_upload_id column, FK, and index
    ALTER TABLE submission_feature
      DROP CONSTRAINT IF EXISTS submission_feature_fk4;

    DROP INDEX IF EXISTS submission_feature_idx4;

    ALTER TABLE submission_feature
      DROP COLUMN submission_upload_id;

    -- 2. Restore upload_id column with FK → upload
    ALTER TABLE submission_feature
      ADD COLUMN upload_id uuid NOT NULL;

    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_fk4
        FOREIGN KEY (upload_id) REFERENCES upload(upload_id);

    CREATE INDEX submission_feature_idx4
      ON submission_feature(upload_id);

    COMMENT ON COLUMN submission_feature.upload_id IS 'Foreign key to the upload session.';
  `);
}
