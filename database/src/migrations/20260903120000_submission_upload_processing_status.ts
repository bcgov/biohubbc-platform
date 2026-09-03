import type { Knex } from 'knex';

/**
 * Retain submission upload processing status history in `submission_upload_status`.
 *
 * The table already holds the admin review decision rows (`submitted`, `approved`, `denied`,
 * `deleted`). It now also holds one row per processing status transition, distinguished by
 * status value and end-dated with `record_end_date` when a later reprocessing attempt supersedes
 * the stage. `submission_upload.status` remains the authoritative current status.
 *
 * 1) extend the processing lifecycle enum with the promotion stage
 * 2) allow processing status values in `submission_upload_status.status`
 * 3) add `record_end_date` and an active-row index
 * 4) document both row classes
 *
 * New enum values are unusable until this migration's transaction commits, so nothing here
 * references them. Existing uploads are not backfilled.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Extend the submission upload processing lifecycle
    --------------------------------------------------------------------------------
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'promoting' AFTER 'reconciled';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'promoted' AFTER 'promoting';

    --------------------------------------------------------------------------------
    -- 2) Allow processing status values in submission_upload_status.status
    --------------------------------------------------------------------------------
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'uploaded';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'ingesting';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'ingested';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'reconciling';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'reconciled';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'promoting';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'promoted';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'indexing';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'indexed';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'invalid';
    ALTER TYPE submission_upload_status_type ADD VALUE IF NOT EXISTS 'failed';

    --------------------------------------------------------------------------------
    -- 3) Soft-end superseded processing status rows
    --------------------------------------------------------------------------------
    ALTER TABLE submission_upload_status ADD COLUMN record_end_date timestamptz(6);

    CREATE INDEX submission_upload_status_active_idx
      ON submission_upload_status(submission_upload_id, status)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 4) Document both row classes
    --------------------------------------------------------------------------------
    COMMENT ON TABLE submission_upload_status IS 'Status history for a submission upload. Holds two row classes, told apart by status value: admin review decisions (submitted, approved, denied, deleted; append-only, latest row wins) and processing status transitions (submission_upload_job_status values; one row per transition, active while record_end_date is null). submission_upload.status remains the authoritative current processing status.';
    COMMENT ON COLUMN submission_upload_status.status IS 'Review decision (submitted = unreviewed, approved = accepted by admin, denied = rejected by admin, deleted = upload has been deleted) or processing status (uploaded, ingesting, ingested, reconciling, reconciled, promoting, promoted, indexing, indexed, invalid, failed).';
    COMMENT ON COLUMN submission_upload_status.record_end_date IS 'When a processing status row was superseded by reprocessing from the same or an earlier stage. Null while the row is active. Review decision rows are never end-dated.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_status_active_idx;

    ALTER TABLE submission_upload_status DROP COLUMN IF EXISTS record_end_date;

    COMMENT ON TABLE submission_upload_status IS 'Tracks the review status of a submission upload. Each row represents the current review state (submitted, approved, or denied) for a given submission_upload_id.';
    COMMENT ON COLUMN submission_upload_status.status IS 'Review status of the submission upload. submitted = unreviewed, approved = accepted by admin, denied = rejected by admin, deleted = upload has been deleted.';

    -- Retain the added enum values.
    -- PostgreSQL enum values cannot be removed without replacing the enum type.
    -- Leaving the now-unused values is safe and preserves rollback compatibility.
  `);
}
