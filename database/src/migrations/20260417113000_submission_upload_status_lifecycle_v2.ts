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
  `);
}
