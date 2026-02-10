import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- REQUEST_STATUS ENUM (for data_request_status)
    --------------------------------------------------------------------------------

    CREATE TYPE request_status AS ENUM (
      'REQUESTED',
      'APPROVED',
      'DENIED'
    );

    --------------------------------------------------------------------------------
    -- DATA REQUEST
    --------------------------------------------------------------------------------

    CREATE TABLE data_request (
      data_request_id uuid DEFAULT gen_random_uuid() NOT NULL,
      reason text NOT NULL,
      team_id uuid NOT NULL,
      requested_by integer NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_pk PRIMARY KEY (data_request_id),
      CONSTRAINT data_request_team_fk
        FOREIGN KEY (team_id)
        REFERENCES team(team_id),
      CONSTRAINT data_request_requested_by_fk
        FOREIGN KEY (requested_by)
        REFERENCES "system_user"(system_user_id)
    );

    CREATE INDEX data_request_team_idx ON data_request(team_id);
    CREATE INDEX data_request_requested_by_idx ON data_request(requested_by);

    COMMENT ON TABLE data_request IS 'Tracks user-submitted data requests.';
    COMMENT ON COLUMN data_request.data_request_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN data_request.reason IS 'Reason for the data request.';
    COMMENT ON COLUMN data_request.team_id IS 'Foreign key to the team.';
    COMMENT ON COLUMN data_request.requested_by IS 'Foreign key to the system user who submitted the request.';
    COMMENT ON COLUMN data_request.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN data_request.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- COMMENT
    --------------------------------------------------------------------------------

    CREATE TABLE comment (
      comment_id uuid DEFAULT gen_random_uuid() NOT NULL,
      comment text NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT comment_pk PRIMARY KEY (comment_id)
    );

    COMMENT ON TABLE comment IS 'Stores comments.';
    COMMENT ON COLUMN comment.comment_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN comment.comment IS 'The comment text.';
    COMMENT ON COLUMN comment.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN comment.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN comment.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN comment.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN comment.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DATA REQUEST STATUS
    --------------------------------------------------------------------------------

    CREATE TABLE data_request_status (
      data_request_status_id uuid DEFAULT gen_random_uuid() NOT NULL,
      data_request_id uuid NOT NULL,
      comment_id uuid,
      request_status request_status NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_status_pk PRIMARY KEY (data_request_status_id),
      CONSTRAINT data_request_status_data_request_fk
        FOREIGN KEY (data_request_id)
        REFERENCES data_request(data_request_id),
      CONSTRAINT data_request_status_comment_fk
        FOREIGN KEY (comment_id)
        REFERENCES comment(comment_id)
    );

    CREATE INDEX data_request_status_data_request_idx ON data_request_status(data_request_id);
    CREATE INDEX data_request_status_comment_idx ON data_request_status(comment_id);

    COMMENT ON TABLE data_request_status IS 'Tracks admin status changes on data requests.';
    COMMENT ON COLUMN data_request_status.data_request_status_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN data_request_status.data_request_id IS 'Foreign key to the data request.';
    COMMENT ON COLUMN data_request_status.comment_id IS 'Foreign key to an optional comment.';
    COMMENT ON COLUMN data_request_status.request_status IS 'Status of the request: REQUESTED, APPROVED, or DENIED.';
    COMMENT ON COLUMN data_request_status.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN data_request_status.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_status.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_status.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_status.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_status.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_data_request
      BEFORE INSERT OR UPDATE OR DELETE ON data_request
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_data_request
      AFTER INSERT OR UPDATE OR DELETE ON data_request
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_comment
      BEFORE INSERT OR UPDATE OR DELETE ON comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_comment
      AFTER INSERT OR UPDATE OR DELETE ON comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_data_request_status
      BEFORE INSERT OR UPDATE OR DELETE ON data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_data_request_status
      AFTER INSERT OR UPDATE OR DELETE ON data_request_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_data_request_status ON data_request_status;
    DROP TRIGGER IF EXISTS audit_data_request_status ON data_request_status;
    DROP TRIGGER IF EXISTS journal_comment ON comment;
    DROP TRIGGER IF EXISTS audit_comment ON comment;
    DROP TRIGGER IF EXISTS journal_data_request ON data_request;
    DROP TRIGGER IF EXISTS audit_data_request ON data_request;

    DROP TABLE IF EXISTS data_request_status;
    DROP TABLE IF EXISTS comment;
    DROP TABLE IF EXISTS data_request;

    DROP TYPE IF EXISTS request_status;
  `);
}
