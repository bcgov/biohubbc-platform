import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ALTER DATA_REQUEST - ADD TICKET_ID
    --------------------------------------------------------------------------------

    ALTER TABLE data_request
      ADD COLUMN ticket_id uuid;

    ALTER TABLE data_request
      ADD CONSTRAINT data_request_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES ticket(ticket_id);

    CREATE INDEX data_request_ticket_idx
      ON data_request(ticket_id);

    COMMENT ON COLUMN data_request.ticket_id IS 'Foreign key to the governing ticket associated with this data request.';

    --------------------------------------------------------------------------------
    -- ALTER SUBMISSION_UPLOAD - ADD TICKET_ID
    --------------------------------------------------------------------------------

    ALTER TABLE submission_upload
      ADD COLUMN ticket_id uuid;

    ALTER TABLE submission_upload
      ADD CONSTRAINT submission_upload_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES ticket(ticket_id);

    CREATE INDEX submission_upload_ticket_idx
      ON submission_upload(ticket_id);

    COMMENT ON COLUMN submission_upload.ticket_id IS 'Foreign key to the governing ticket associated with this submission upload.';

    --------------------------------------------------------------------------------
    -- TICKET STATUS ENUM
    --------------------------------------------------------------------------------

    CREATE TYPE ticket_status_type AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'CLOSED'
    );

    --------------------------------------------------------------------------------
    -- TICKET PRIORITY ENUM
    --------------------------------------------------------------------------------

    CREATE TYPE ticket_priority AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
    );

    --------------------------------------------------------------------------------
    -- TICKET
    --------------------------------------------------------------------------------

    CREATE TABLE ticket (
      ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
      team_id uuid NOT NULL,
      priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_pk PRIMARY KEY (ticket_id),
      CONSTRAINT ticket_team_fk
        FOREIGN KEY (team_id)
        REFERENCES team(team_id)
    );

    CREATE INDEX ticket_team_idx ON ticket(team_id);
    CREATE INDEX ticket_priority_idx ON ticket(priority);

    COMMENT ON TABLE ticket IS 'Represents a governance ticket for actions requiring admin review (downloads, requests, uploads, etc.).';
    COMMENT ON COLUMN ticket.ticket_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket.team_id IS 'Foreign key to the team associated with this ticket.';
    COMMENT ON COLUMN ticket.priority IS 'Priority of the ticket: LOW, MEDIUM, HIGH.';
    COMMENT ON COLUMN ticket.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- COMMENT (FLAT, REPLIES VIA MENTION PARSING)
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

    COMMENT ON TABLE comment IS 'Stores user-generated comments. Replies/mentions are handled via text parsing in the frontend.';
    COMMENT ON COLUMN comment.comment_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN comment.comment IS 'The comment text, may include mentions like @ticket-123.';
    COMMENT ON COLUMN comment.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN comment.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN comment.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN comment.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN comment.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET COMMENT (JOIN TO COMMENT)
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_comment (
      ticket_comment_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      comment_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_comment_pk PRIMARY KEY (ticket_comment_id),
      CONSTRAINT ticket_comment_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_comment_comment_fk
        FOREIGN KEY (comment_id)
        REFERENCES comment(comment_id)
    );

    CREATE INDEX ticket_comment_ticket_idx ON ticket_comment(ticket_id);
    CREATE INDEX ticket_comment_comment_idx ON ticket_comment(comment_id);

    COMMENT ON TABLE ticket_comment IS 'Associates existing comments with tickets.';
    COMMENT ON COLUMN ticket_comment.ticket_comment_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_comment.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_comment.comment_id IS 'Foreign key to the comment table.';
    COMMENT ON COLUMN ticket_comment.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_comment.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_comment.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_comment.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_comment.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_comment.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET STATUS
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_status (
      ticket_status_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      ticket_status ticket_status_type NOT NULL,
      comment_id uuid,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_status_pk PRIMARY KEY (ticket_status_id),
      CONSTRAINT ticket_status_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_status_comment_fk
        FOREIGN KEY (comment_id)
        REFERENCES comment(comment_id)
    );

    CREATE INDEX ticket_status_ticket_idx ON ticket_status(ticket_id);
    CREATE INDEX ticket_status_comment_idx ON ticket_status(comment_id);

    COMMENT ON TABLE ticket_status IS 'Tracks lifecycle status changes for tickets.';
    COMMENT ON COLUMN ticket_status.ticket_status_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_status.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_status.ticket_status IS 'Status of the ticket: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CLOSED.';
    COMMENT ON COLUMN ticket_status.comment_id IS 'Optional foreign key to a comment associated with this status change.';
    COMMENT ON COLUMN ticket_status.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_status.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_status.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_status.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_status.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_status.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET RELATIONSHIP
    --------------------------------------------------------------------------------

    CREATE TYPE ticket_relationship_type AS ENUM (
      'BLOCKED_BY',
      'REFERENCES'
    );

    CREATE TABLE ticket_relationship (
      ticket_relationship_id uuid DEFAULT gen_random_uuid() NOT NULL,
      child_ticket_id uuid NOT NULL,
      parent_ticket_id uuid NOT NULL,
      relationship ticket_relationship_type NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_relationship_pk PRIMARY KEY (ticket_relationship_id),
      CONSTRAINT ticket_relationship_child_fk FOREIGN KEY (child_ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_relationship_parent_fk FOREIGN KEY (parent_ticket_id) REFERENCES ticket(ticket_id)
    );

    CREATE INDEX ticket_relationship_child_idx ON ticket_relationship(child_ticket_id);
    CREATE INDEX ticket_relationship_parent_idx ON ticket_relationship(parent_ticket_id);

    COMMENT ON TABLE ticket_relationship IS 'Associates tickets with other tickets to indicate dependencies or references.';
    COMMENT ON COLUMN ticket_relationship.ticket_relationship_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_relationship.child_ticket_id IS 'Foreign key to the dependent (child) ticket.';
    COMMENT ON COLUMN ticket_relationship.parent_ticket_id IS 'Foreign key to the parent or referenced ticket.';
    COMMENT ON COLUMN ticket_relationship.relationship IS 'Type of relationship: BLOCKED_BY, REFERENCES.';
    COMMENT ON COLUMN ticket_relationship.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_relationship.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_relationship.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_relationship.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_relationship.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_ticket
      BEFORE INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket
      AFTER INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_comment
      BEFORE INSERT OR UPDATE OR DELETE ON comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_comment
      AFTER INSERT OR UPDATE OR DELETE ON comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_comment
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_comment
      AFTER INSERT OR UPDATE OR DELETE ON ticket_comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_status
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_status
      AFTER INSERT OR UPDATE OR DELETE ON ticket_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_relationship
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_relationship
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_relationship
      AFTER INSERT OR UPDATE OR DELETE ON ticket_relationship
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_ticket_relationship ON ticket_relationship;
    DROP TRIGGER IF EXISTS audit_ticket_relationship ON ticket_relationship;
    DROP TRIGGER IF EXISTS journal_ticket_status ON ticket_status;
    DROP TRIGGER IF EXISTS audit_ticket_status ON ticket_status;
    DROP TRIGGER IF EXISTS journal_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS audit_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS journal_comment ON comment;
    DROP TRIGGER IF EXISTS audit_comment ON comment;
    DROP TRIGGER IF EXISTS journal_ticket ON ticket;
    DROP TRIGGER IF EXISTS audit_ticket ON ticket;

    DROP TABLE IF EXISTS ticket_relationship;
    DROP TYPE IF EXISTS ticket_relationship_type;
    DROP TABLE IF EXISTS ticket_status;
    DROP TABLE IF EXISTS ticket_comment;
    DROP TABLE IF EXISTS comment;
    DROP TABLE IF EXISTS ticket;

    DROP TYPE IF EXISTS ticket_status_type;
    DROP TYPE IF EXISTS ticket_priority;

    ALTER TABLE submission_upload DROP CONSTRAINT submission_upload_ticket_fk;
    ALTER TABLE submission_upload DROP COLUMN ticket_id;
    DROP INDEX IF EXISTS submission_upload_ticket_idx;

    ALTER TABLE data_request DROP CONSTRAINT data_request_ticket_fk;
    ALTER TABLE data_request DROP COLUMN ticket_id;
    DROP INDEX IF EXISTS data_request_ticket_idx;
  `);
}
