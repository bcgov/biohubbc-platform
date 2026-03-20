import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_status_idx;

    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS submission_upload_job_status;
  `);
}
