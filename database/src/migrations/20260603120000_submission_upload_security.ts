import { Knex } from 'knex';

/**
 * Create the submission_upload_security table.
 *
 * One row represents one automatic security screening *event* for a submission upload. Screening
 * is an independent background workflow (it does not change submission_upload.status); this table
 * owns its lifecycle: status, started/ended timestamps, errors, and metadata. The pg-boss job_id
 * is recorded for resync. The table is append-only — a re-screen inserts a new event row, so a
 * "latest scan" read orders by create_date (there is no unique constraint on submission_upload_id).
 *
 * Mirrors the submission_validation table pattern (PG enum status, audit + journal triggers).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Status enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_security_status AS ENUM (
      'pending',    -- Queued but not started
      'started',    -- Screening in progress
      'completed',  -- Screening finished successfully
      'failed'      -- System error during screening
    );

    COMMENT ON TYPE submission_upload_security_status IS
      'Lifecycle of an automatic security screening event: pending=queued; started=in progress; completed=finished successfully; failed=system error.';

    --------------------------------------------------------------------------------
    -- Create submission_upload_security table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_upload_security (
      submission_upload_security_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id           UUID NOT NULL,
      job_id                         UUID,
      status                         submission_upload_security_status NOT NULL DEFAULT 'pending'::submission_upload_security_status,
      metadata                       JSONB,
      started_at                     TIMESTAMPTZ,
      ended_at                       TIMESTAMPTZ,
      create_date                    TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user                    INTEGER NOT NULL,
      update_date                    TIMESTAMPTZ,
      update_user                    INTEGER,
      revision_count                 INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT submission_upload_security_fk1
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id)
    );

    --------------------------------------------------------------------------------
    -- Create indexes
    --------------------------------------------------------------------------------
    CREATE INDEX submission_upload_security_idx1 ON submission_upload_security(submission_upload_id);
    CREATE INDEX submission_upload_security_idx2 ON submission_upload_security(job_id);
    CREATE INDEX submission_upload_security_idx3 ON submission_upload_security(status);

    --------------------------------------------------------------------------------
    -- Add audit trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_submission_upload_security
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_security
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    --------------------------------------------------------------------------------
    -- Add journal trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER journal_submission_upload_security
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_security
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE submission_upload_security IS 'Tracks automatic security screening events for a submission upload. One row per screening run; append-only history.';
    COMMENT ON COLUMN submission_upload_security.submission_upload_security_id IS 'Primary key.';
    COMMENT ON COLUMN submission_upload_security.submission_upload_id IS 'Foreign key to the submission_upload that was screened.';
    COMMENT ON COLUMN submission_upload_security.job_id IS 'pg-boss job UUID for resync capability.';
    COMMENT ON COLUMN submission_upload_security.status IS 'Screening event status: pending, started, completed, or failed.';
    COMMENT ON COLUMN submission_upload_security.metadata IS 'JSON metadata containing error messages or screening details (e.g. rule and insert counts).';
    COMMENT ON COLUMN submission_upload_security.started_at IS 'Timestamp when screening began.';
    COMMENT ON COLUMN submission_upload_security.ended_at IS 'Timestamp when screening completed.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS submission_upload_security CASCADE;

    DROP TYPE IF EXISTS submission_upload_security_status;
  `);
}
