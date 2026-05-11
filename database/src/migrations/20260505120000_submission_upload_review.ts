import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create submission_upload_review_scope enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_review_scope AS ENUM (
      'validation',
      'security'
    );

    --------------------------------------------------------------------------------
    -- Create submission_upload_review_status enum
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_review_status AS ENUM (
      'requested',
      'in_progress',
      'completed',
      'blocked',
      'skipped',
      'cancelled'
    );

    --------------------------------------------------------------------------------
    -- Add submission_upload.comment
    --------------------------------------------------------------------------------
    ALTER TABLE submission_upload
      ADD COLUMN comment text;

    COMMENT ON COLUMN submission_upload.comment IS 'Admin-facing comment associated with this specific submission upload.';

    --------------------------------------------------------------------------------
    -- Create submission_upload_review table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_upload_review (
      submission_upload_review_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      scope submission_upload_review_scope NOT NULL,
      status submission_upload_review_status NOT NULL DEFAULT 'requested',
      requested_by integer,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      record_end_date timestamptz(6),

      CONSTRAINT submission_upload_review_fk1
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_review_fk2
        FOREIGN KEY (requested_by) REFERENCES "system_user"(system_user_id)
    );

    --------------------------------------------------------------------------------
    -- Create indexes
    --------------------------------------------------------------------------------
    -- Supports listing active reviews for one upload, the ticket-detail lateral
    -- aggregation, and multi-upload review fetches ordered by create_date.
    CREATE INDEX submission_upload_review_idx1
      ON submission_upload_review(submission_upload_id, create_date)
      WHERE record_end_date IS NULL;

    -- Supports ticket detail upload timelines ordered by upload create date.
    CREATE INDEX submission_upload_idx2
      ON submission_upload(ticket_id, create_date)
      WHERE record_end_date IS NULL;

    -- Supports fetching the latest validation row for each upload in ticket detail.
    CREATE INDEX submission_validation_idx5
      ON submission_validation(submission_upload_id, create_date DESC);

    -- Prevents duplicate active review tasks for the same upload/scope and
    -- supports idempotent lookup before inserting default/manual reviews.
    CREATE UNIQUE INDEX submission_upload_review_nuk1
      ON submission_upload_review(submission_upload_id, scope)
      WHERE record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- Add audit trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_submission_upload_review
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_review
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    --------------------------------------------------------------------------------
    -- Add journal trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER journal_submission_upload_review
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_review
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE submission_upload_review IS 'Tracks human/admin review tasks for a submission upload, scoped by review type.';
    COMMENT ON COLUMN submission_upload_review.submission_upload_review_id IS 'Primary key.';
    COMMENT ON COLUMN submission_upload_review.submission_upload_id IS 'Foreign key to submission_upload.';
    COMMENT ON COLUMN submission_upload_review.scope IS 'Review scope, such as validation or security.';
    COMMENT ON COLUMN submission_upload_review.status IS 'Review workflow status: requested, in_progress, completed, blocked, skipped, or cancelled.';
    COMMENT ON COLUMN submission_upload_review.requested_by IS 'System user who requested the review.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_validation_idx5;
    DROP INDEX IF EXISTS submission_upload_idx2;
    DROP TRIGGER IF EXISTS journal_submission_upload_review ON submission_upload_review;
    DROP TRIGGER IF EXISTS audit_submission_upload_review ON submission_upload_review;
    DROP TABLE IF EXISTS submission_upload_review CASCADE;
    DROP TYPE IF EXISTS submission_upload_review_status;
    DROP TYPE IF EXISTS submission_upload_review_scope;
    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS comment;
  `);
}
