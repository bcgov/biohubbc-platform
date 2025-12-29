import { Knex } from 'knex';

/**
 * Migration to create submission_validation table for tracking submission processing status.
 *
 * This table acts as a queue for tracking submission validation workloads and provides:
 * - Status tracking for background submission processing
 * - Admin UI for monitoring submission validation status
 * - Link to pg-boss job for resync capability
 *
 * See: SIMSBIOHUB-801
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create submission_validation table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_validation (
      submission_validation_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_id             INTEGER NOT NULL,
      job_id                    UUID NOT NULL,
      status                    VARCHAR(20) NOT NULL DEFAULT 'pending',
      metadata                  JSONB,
      started_at                TIMESTAMPTZ,
      ended_at                  TIMESTAMPTZ,
      create_date               TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user               INTEGER NOT NULL,
      update_date               TIMESTAMPTZ,
      update_user               INTEGER,
      revision_count            INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT submission_validation_fk1
        FOREIGN KEY (submission_id) REFERENCES submission(submission_id),

      CONSTRAINT submission_validation_status_check
        CHECK (status IN ('pending', 'started', 'completed', 'invalid', 'failed'))
    );

    --------------------------------------------------------------------------------
    -- Create indexes
    --------------------------------------------------------------------------------
    CREATE INDEX submission_validation_idx1 ON submission_validation(submission_id);
    CREATE INDEX submission_validation_idx2 ON submission_validation(job_id);
    CREATE INDEX submission_validation_idx3 ON submission_validation(status);

    --------------------------------------------------------------------------------
    -- Add audit trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_submission_validation
      BEFORE INSERT OR UPDATE OR DELETE ON submission_validation
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    --------------------------------------------------------------------------------
    -- Add journal trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER journal_submission_validation
      AFTER INSERT OR UPDATE OR DELETE ON submission_validation
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE submission_validation IS 'Tracks background job status for submission validation and feature processing.';
    COMMENT ON COLUMN submission_validation.submission_validation_id IS 'Primary key.';
    COMMENT ON COLUMN submission_validation.submission_id IS 'Foreign key to submission table.';
    COMMENT ON COLUMN submission_validation.job_id IS 'pg-boss job UUID for resync capability.';
    COMMENT ON COLUMN submission_validation.status IS 'Validation status: pending, started, completed, invalid, or failed.';
    COMMENT ON COLUMN submission_validation.metadata IS 'JSON metadata containing error messages or processing details.';
    COMMENT ON COLUMN submission_validation.started_at IS 'Timestamp when validation began.';
    COMMENT ON COLUMN submission_validation.ended_at IS 'Timestamp when validation completed.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS submission_validation CASCADE;
  `);
}
