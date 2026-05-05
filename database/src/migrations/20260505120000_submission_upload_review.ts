import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_upload_review_scope AS ENUM (
      'validation',
      'security'
    );

    CREATE TYPE submission_upload_review_status AS ENUM (
      'requested',
      'in_progress',
      'completed',
      'blocked',
      'skipped',
      'cancelled'
    );

    CREATE TABLE submission_upload_review (
      submission_upload_review_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      submission_upload_id uuid NOT NULL,
      scope submission_upload_review_scope NOT NULL,
      status submission_upload_review_status NOT NULL DEFAULT 'requested',
      requested_by integer,
      requested_at timestamptz(6) DEFAULT now() NOT NULL,
      assigned_to integer,
      started_at timestamptz(6),
      completed_by integer,
      completed_at timestamptz(6),
      note text,
      metadata jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      record_end_date timestamptz(6),

      CONSTRAINT submission_upload_review_fk1
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_review_fk2
        FOREIGN KEY (requested_by) REFERENCES "system_user"(system_user_id),
      CONSTRAINT submission_upload_review_fk3
        FOREIGN KEY (assigned_to) REFERENCES "system_user"(system_user_id),
      CONSTRAINT submission_upload_review_fk4
        FOREIGN KEY (completed_by) REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX submission_upload_review_idx1
      ON submission_upload_review(submission_upload_id);

    CREATE INDEX submission_upload_review_idx2
      ON submission_upload_review(scope);

    CREATE INDEX submission_upload_review_idx3
      ON submission_upload_review(status);

    CREATE INDEX submission_upload_review_idx4
      ON submission_upload_review(submission_upload_id, scope, status)
      WHERE record_end_date IS NULL;

    CREATE UNIQUE INDEX submission_upload_review_nuk1
      ON submission_upload_review(submission_upload_id, scope)
      WHERE record_end_date IS NULL
        AND status IN ('requested', 'in_progress', 'blocked');

    CREATE TRIGGER audit_submission_upload_review
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_review
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_upload_review
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_review
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    COMMENT ON TABLE submission_upload_review IS 'Tracks human/admin review tasks for a submission upload, scoped by review type.';
    COMMENT ON COLUMN submission_upload_review.submission_upload_review_id IS 'Primary key.';
    COMMENT ON COLUMN submission_upload_review.submission_upload_id IS 'Foreign key to submission_upload.';
    COMMENT ON COLUMN submission_upload_review.scope IS 'Review scope, such as validation or security.';
    COMMENT ON COLUMN submission_upload_review.status IS 'Review workflow status: requested, in_progress, completed, blocked, skipped, or cancelled.';
    COMMENT ON COLUMN submission_upload_review.requested_by IS 'System user who requested the review.';
    COMMENT ON COLUMN submission_upload_review.requested_at IS 'Timestamp when the review was requested.';
    COMMENT ON COLUMN submission_upload_review.assigned_to IS 'System user currently assigned to the review.';
    COMMENT ON COLUMN submission_upload_review.started_at IS 'Timestamp when review work started.';
    COMMENT ON COLUMN submission_upload_review.completed_by IS 'System user who completed, skipped, cancelled, or blocked the review.';
    COMMENT ON COLUMN submission_upload_review.completed_at IS 'Timestamp when the review reached a terminal or paused state.';
    COMMENT ON COLUMN submission_upload_review.note IS 'Optional admin-facing note for the review.';
    COMMENT ON COLUMN submission_upload_review.metadata IS 'Optional structured metadata for review details.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_upload_review ON submission_upload_review;
    DROP TRIGGER IF EXISTS audit_submission_upload_review ON submission_upload_review;
    DROP TABLE IF EXISTS submission_upload_review CASCADE;
    DROP TYPE IF EXISTS submission_upload_review_status;
    DROP TYPE IF EXISTS submission_upload_review_scope;
  `);
}
