import { Knex } from 'knex';

/**
 * Cut over submission_upload.status to explicit lifecycle states used by SIMSBIOHUB-924.
 *
 * pending -> uploaded
 * in_progress -> ingesting
 * succeeded -> ingested
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Cut over submission_upload.status to lifecycle v2 enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v2 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'indexing',
      'indexed',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v2
      USING (
        CASE status::text
          WHEN 'pending' THEN 'uploaded'
          WHEN 'in_progress' THEN 'ingesting'
          WHEN 'succeeded' THEN 'ingested'
          ELSE status::text
        END
      )::submission_upload_job_status_v2;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v2 RENAME TO submission_upload_job_status;

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Submission pipeline lifecycle status: uploaded, ingesting, ingested, indexing, indexed, invalid, failed.';

    --------------------------------------------------------------------------------
    -- 2) Add upload_artifact soft-delete marker and active-row uniqueness
    --------------------------------------------------------------------------------
    -- record_end_date enables soft-delete semantics for upload_artifact rows.
    ALTER TABLE upload_artifact
      ADD COLUMN IF NOT EXISTS record_end_date timestamptz(6);

    -- Replace legacy uniqueness (which considered all rows) with active-row
    -- partial unique indexes so soft-deleted rows do not block re-ingestion.
    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_uq;
    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_upload_artifact_uq;

    DROP INDEX IF EXISTS upload_artifact_upload_artifact_uk1;
    DROP INDEX IF EXISTS upload_artifact_upload_path_uk1;

    CREATE UNIQUE INDEX IF NOT EXISTS upload_artifact_upload_artifact_uk1
      ON upload_artifact(upload_id, artifact_id)
      WHERE record_end_date IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS upload_artifact_upload_path_uk1
      ON upload_artifact(upload_id, path)
      WHERE path IS NOT NULL
        AND record_end_date IS NULL;

    COMMENT ON COLUMN upload_artifact.record_end_date IS
      'Soft-delete marker for upload_artifact rows. NULL indicates active record.';
  `);
}

/**
 * Revert submission_upload.status lifecycle states back to the consolidated enum.
 *
 * uploaded -> pending
 * ingesting -> in_progress
 * ingested/indexing/indexed -> succeeded
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Revert submission_upload.status back to lifecycle v1 enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v1 AS ENUM (
      'pending',
      'in_progress',
      'succeeded',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v1
      USING (
        CASE status::text
          WHEN 'uploaded' THEN 'pending'
          WHEN 'ingesting' THEN 'in_progress'
          WHEN 'ingested' THEN 'succeeded'
          WHEN 'indexing' THEN 'succeeded'
          WHEN 'indexed' THEN 'succeeded'
          ELSE status::text
        END
      )::submission_upload_job_status_v1;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v1 RENAME TO submission_upload_job_status;

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'pending'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Submission processing status: pending, in_progress, succeeded, invalid, failed.';

    --------------------------------------------------------------------------------
    -- 2) Revert upload_artifact soft-delete/index strategy
    --------------------------------------------------------------------------------
    -- Remove soft-deleted rows before restoring non-partial uniqueness.
    DELETE FROM upload_artifact
    WHERE record_end_date IS NOT NULL;

    DROP INDEX IF EXISTS upload_artifact_upload_artifact_uk1;
    DROP INDEX IF EXISTS upload_artifact_upload_path_uk1;

    ALTER TABLE upload_artifact
      ADD CONSTRAINT upload_artifact_upload_artifact_uq UNIQUE (upload_id, artifact_id);

    CREATE UNIQUE INDEX IF NOT EXISTS upload_artifact_upload_path_uk1
      ON upload_artifact(upload_id, path)
      WHERE path IS NOT NULL;

    ALTER TABLE upload_artifact
      DROP COLUMN IF EXISTS record_end_date;
  `);
}
