import { Knex } from 'knex';

/**
 * Extend submission_upload_job_status with automatic security screening lifecycle states.
 *
 * security_screening — automatic screening job is running for this upload.
 * security_screened  — automatic screening completed; upload has reached terminal success.
 *
 * 'indexed' was previously the terminal-success state. After this migration it is an
 * intermediate state; 'security_screened' becomes the new terminal success.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_upload_job_status_v3 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'indexing',
      'indexed',
      'security_screening',
      'security_screened',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v3
      USING status::text::submission_upload_job_status_v3;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v3 RENAME TO submission_upload_job_status;

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload lifecycle: uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready; security_screening=automatic security screening in progress; security_screened=automatic screening complete (terminal success); invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Submission upload lifecycle status. uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready; security_screening=automatic security screening in progress; security_screened=automatic screening complete (terminal success); invalid=deterministic validation errors; failed=operational/runtime failure.';
  `);
}

/**
 * Revert the enum to the v2 shape (drop security_screening and security_screened).
 *
 * Rows in security_screening or security_screened are mapped back to 'indexed' since
 * that was the closest terminal-success state before this migration.
 */
export async function down(knex: Knex): Promise<void> {
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
          WHEN 'security_screening' THEN 'indexed'
          WHEN 'security_screened'  THEN 'indexed'
          ELSE status::text
        END
      )::submission_upload_job_status_v2;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v2 RENAME TO submission_upload_job_status;

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload lifecycle: uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready (terminal success); invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Submission upload lifecycle status. uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';
  `);
}
