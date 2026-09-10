import type { Knex } from 'knex';

/**
 * Separate the human review decision from the processing status of a submission upload, and turn
 * `submission_upload_status` into the processing status transition log.
 *
 * Before this migration `submission_upload_status` held append-only review decision rows
 * (`submitted`, `approved`, `denied`, `deleted`; latest row wins). The decision now lives on
 * `submission_upload.decision` (`pending`, `approved`, `denied`), deletion is expressed by
 * `submission_upload.record_end_date`, and `submission_upload_status` holds one row per processing
 * status transition, active while `record_end_date` is null. `submission_upload.status` remains the
 * authoritative current processing status; the log is history only.
 *
 * 1) add `submission_upload.decision`, backfilled from the latest review decision row per upload
 * 2) remove the review decision rows
 * 3) replace `submission_upload_job_status`: drop `reconciling` (never committed, reconciliation runs
 *    in one transaction) and add `promoted`
 * 4) type `submission_upload_status.status` with `submission_upload_job_status`, drop the review
 *    enum, add `record_end_date` and an active-row index
 *
 * Every new enum is created with CREATE TYPE (usable in this transaction); the swap pattern follows
 * 20260427120000_submission_feature_indexing.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Human review decision on submission_upload
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_decision AS ENUM ('pending', 'approved', 'denied');

    COMMENT ON TYPE submission_upload_decision IS
      'Human review decision on a submission upload: pending=awaiting review; approved=accepted by an administrator; denied=rejected by an administrator.';

    ALTER TABLE submission_upload
      ADD COLUMN decision submission_upload_decision NOT NULL DEFAULT 'pending';

    COMMENT ON COLUMN submission_upload.decision IS
      'Human review decision on the upload. Independent of the processing status; a deleted upload is expressed by record_end_date rather than a decision value.';

    -- Latest non-deleted review decision row per upload. A deleted upload only ever carried
    -- "submitted" before its "deleted" row, so it lands on the pending default.
    UPDATE submission_upload su
    SET decision = (
      CASE latest.status::text
        WHEN 'approved' THEN 'approved'
        WHEN 'denied' THEN 'denied'
        ELSE 'pending'
      END
    )::submission_upload_decision
    FROM (
      SELECT DISTINCT ON (submission_upload_id)
        submission_upload_id,
        status
      FROM submission_upload_status
      WHERE status::text <> 'deleted'
      ORDER BY submission_upload_id, create_date DESC, submission_upload_status_id DESC
    ) latest
    WHERE latest.submission_upload_id = su.submission_upload_id;

    --------------------------------------------------------------------------------
    -- 2) Remove the review decision rows; the table becomes the processing status log
    --------------------------------------------------------------------------------
    DELETE FROM submission_upload_status;

    --------------------------------------------------------------------------------
    -- 3) Processing lifecycle: drop reconciling, add promoted
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v2 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'reconciled',
      'promoted',
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
          WHEN 'reconciling' THEN 'ingested'
          WHEN 'promoting' THEN 'reconciled'
          ELSE status::text
        END
      )::submission_upload_job_status_v2;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v2 RENAME TO submission_upload_job_status;

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload processing lifecycle: uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Authoritative current processing status of the upload. uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    --------------------------------------------------------------------------------
    -- 4) submission_upload_status: processing status transition log
    --------------------------------------------------------------------------------
    ALTER TABLE submission_upload_status
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload_status
      ALTER COLUMN status TYPE submission_upload_job_status
      USING status::text::submission_upload_job_status;

    DROP TYPE submission_upload_status_type;

    ALTER TABLE submission_upload_status
      ADD COLUMN record_end_date timestamptz(6);

    CREATE INDEX submission_upload_status_active_idx
      ON submission_upload_status(submission_upload_id, status)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE submission_upload_status IS
      'Processing status transition log for a submission upload: one row per status the upload entered, active while record_end_date is null. Reprocessing from the same or an earlier stage end-dates the superseded rows rather than deleting them. submission_upload.status remains the authoritative current status; this table is history only.';
    COMMENT ON COLUMN submission_upload_status.status IS
      'Processing status the upload entered when this row was written.';
    COMMENT ON COLUMN submission_upload_status.record_end_date IS
      'When this row was superseded by reprocessing from the same or an earlier stage. Null while the row is active.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 4) Restore the review decision table shape
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_upload_status_active_idx;

    ALTER TABLE submission_upload_status
      DROP COLUMN IF EXISTS record_end_date;

    DELETE FROM submission_upload_status;

    CREATE TYPE submission_upload_status_type AS ENUM ('submitted', 'approved', 'denied', 'deleted');

    ALTER TABLE submission_upload_status
      ALTER COLUMN status TYPE submission_upload_status_type
      USING 'submitted'::submission_upload_status_type;

    ALTER TABLE submission_upload_status
      ALTER COLUMN status SET DEFAULT 'submitted';

    COMMENT ON TABLE submission_upload_status IS
      'Tracks the review status of a submission upload. Each row represents the current review state (submitted, approved, or denied) for a given submission_upload_id.';
    COMMENT ON COLUMN submission_upload_status.status IS
      'Review status of the submission upload. submitted = unreviewed, approved = accepted by admin, denied = rejected by admin, deleted = upload has been deleted.';

    --------------------------------------------------------------------------------
    -- 3) Restore the processing lifecycle enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v1 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'reconciling',
      'reconciled',
      'indexing',
      'indexed',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v1
      USING (
        CASE status::text
          WHEN 'promoted' THEN 'reconciled'
          ELSE status::text
        END
      )::submission_upload_job_status_v1;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v1 RENAME TO submission_upload_job_status;

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    --------------------------------------------------------------------------------
    -- 2) + 1) Re-materialise the review decision rows and drop the column
    --------------------------------------------------------------------------------
    INSERT INTO submission_upload_status (submission_upload_id, status, create_user)
    SELECT
      submission_upload_id,
      (
        CASE decision::text
          WHEN 'approved' THEN 'approved'
          WHEN 'denied' THEN 'denied'
          ELSE 'submitted'
        END
      )::submission_upload_status_type,
      create_user
    FROM submission_upload
    WHERE record_end_date IS NULL;

    ALTER TABLE submission_upload DROP COLUMN decision;

    DROP TYPE submission_upload_decision;
  `);
}
