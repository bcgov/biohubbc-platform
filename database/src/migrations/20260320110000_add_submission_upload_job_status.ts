import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Add submission_upload.status for ingestion job lifecycle
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status AS ENUM (
      'pending',
      'in_progress',
      'succeeded',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ADD COLUMN status submission_upload_job_status NOT NULL DEFAULT 'pending';

    CREATE INDEX submission_upload_status_idx ON submission_upload(status);

    COMMENT ON COLUMN submission_upload.status IS 'Background ingestion job lifecycle status for this upload attempt (pending, in_progress, succeeded, invalid, failed).';

    --------------------------------------------------------------------------------
    -- 2) Add upload_artifact.path for archive-extracted media tracking
    --------------------------------------------------------------------------------
    ALTER TABLE upload_artifact
      ADD COLUMN IF NOT EXISTS path text;

    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_archive_path_chk;

    ALTER TABLE upload_artifact
      ADD CONSTRAINT upload_artifact_archive_path_chk
      CHECK (
        path IS NULL
        OR upload_archive_id IS NOT NULL
      );

    CREATE INDEX IF NOT EXISTS upload_artifact_path_idx
      ON upload_artifact(path);

    CREATE UNIQUE INDEX IF NOT EXISTS upload_artifact_upload_path_uq
      ON upload_artifact(upload_id, path)
      WHERE path IS NOT NULL;

    COMMENT ON COLUMN upload_artifact.path IS 'Normalized archive-relative path for extracted archive files. NULL for non-archive artifacts.';

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Remove upload_artifact.path changes
    --------------------------------------------------------------------------------
    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_archive_path_chk;

    DROP INDEX IF EXISTS upload_artifact_upload_path_uq;
    DROP INDEX IF EXISTS upload_artifact_path_idx;

    ALTER TABLE upload_artifact
      DROP COLUMN IF EXISTS path;

    --------------------------------------------------------------------------------
    -- 2) Remove submission_upload.status changes
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_upload_status_idx;

    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS submission_upload_job_status;
  `);
}
