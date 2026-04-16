import { Knex } from 'knex';

/**
 * Complete cutover to explicit submission_upload lifecycle states.
 *
 * Removes legacy enum values by rebuilding the enum type and maps old rows:
 * - pending -> uploaded
 * - in_progress -> ingesting
 * - succeeded -> ingested
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    UPDATE submission_upload
    SET status = CASE
      WHEN status::text = 'pending' THEN 'uploaded'::submission_upload_job_status
      WHEN status::text = 'in_progress' THEN 'ingesting'::submission_upload_job_status
      WHEN status::text = 'succeeded' THEN 'ingested'::submission_upload_job_status
      ELSE status
    END
    WHERE status::text IN ('pending', 'in_progress', 'succeeded');

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
      USING status::text::submission_upload_job_status_v2;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v2 RENAME TO submission_upload_job_status;

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS 'Submission pipeline lifecycle status: uploaded, ingesting, ingested, indexing, indexed, invalid, failed.';
  `);
}

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
  `);
}
