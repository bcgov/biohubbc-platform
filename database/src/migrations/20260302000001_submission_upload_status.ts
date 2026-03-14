import { Knex } from 'knex';

/**
 * Create submission_upload_status table to track the review status of each submission upload.
 * Supports statuses: submitted (unreviewed), approved, and denied.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ENUM TYPE
    --------------------------------------------------------------------------------

    CREATE TYPE submission_upload_status_type AS ENUM (
      'submitted',  -- Upload has been submitted and is awaiting admin review
      'approved',   -- Admin has approved the upload
      'denied',     -- Admin has denied the upload
      'deleted'     -- Upload has been deleted
    );

    --------------------------------------------------------------------------------
    -- SUBMISSION_UPLOAD_STATUS
    --------------------------------------------------------------------------------

    CREATE TABLE submission_upload_status (
      submission_upload_status_id  integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id         uuid NOT NULL,
      status                       submission_upload_status_type NOT NULL DEFAULT 'submitted',
      create_date                  timestamptz(6) DEFAULT now() NOT NULL,
      create_user                  integer NOT NULL,
      update_date                  timestamptz(6),
      update_user                  integer,
      revision_count               integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_status_pk PRIMARY KEY (submission_upload_status_id),
      CONSTRAINT submission_upload_status_fk FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id)
    );

    CREATE INDEX submission_upload_status_upload_idx ON submission_upload_status(submission_upload_id);
    CREATE INDEX submission_upload_status_status_idx ON submission_upload_status(status);

    COMMENT ON TABLE submission_upload_status IS 'Tracks the review status of a submission upload. Each row represents the current review state (submitted, approved, or denied) for a given submission_upload_id.';
    COMMENT ON COLUMN submission_upload_status.submission_upload_status_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload_status.submission_upload_id IS 'Foreign key to the submission_upload record.';
    COMMENT ON COLUMN submission_upload_status.status IS 'Review status of the submission upload. submitted = unreviewed, approved = accepted by admin, denied = rejected by admin, deleted = upload has been deleted.';
    COMMENT ON COLUMN submission_upload_status.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload_status.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload_status.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_upload_status.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_upload_status.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_submission_upload_status
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_upload_status
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_upload_status ON submission_upload_status;
    DROP TRIGGER IF EXISTS audit_submission_upload_status ON submission_upload_status;

    DROP TABLE IF EXISTS submission_upload_status;

    DROP TYPE IF EXISTS submission_upload_status_type;
  `);
}
