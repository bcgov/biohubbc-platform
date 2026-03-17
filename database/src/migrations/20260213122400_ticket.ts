import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ENUMS 
    --------------------------------------------------------------------------------

    CREATE TYPE ticket_priority AS ENUM (
      'low',
      'medium',
      'high',
      'critical'
    );

    COMMENT ON TYPE ticket_priority IS 'Priority levels for tickets.';

    CREATE TYPE ticket_relationship_type AS ENUM (
      'blocks',
      'blocked_by',
      'duplicates',
      'duplicate_of',
      'relates_to',
      'resolves',
      'resolved_by'
    );

    COMMENT ON TYPE ticket_relationship_type IS 'Type of relationship between source and target ticket.';

    CREATE TYPE ticket_status_type AS ENUM (
      'open',
      'closed'
    );

    COMMENT ON TYPE ticket_status_type IS 'Lifecycle status for tickets (open or closed).';

    --------------------------------------------------------------------------------
    -- TICKET
    --------------------------------------------------------------------------------

    CREATE TABLE ticket (
      ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_slug varchar(8) NOT NULL,
      subject varchar(100) NOT NULL,
      description varchar(2000) NULL,
      team_id uuid NOT NULL,
      priority ticket_priority NOT NULL DEFAULT 'medium',
      status ticket_status_type NOT NULL DEFAULT 'open',
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_pk PRIMARY KEY (ticket_id),
      CONSTRAINT ticket_team_fk FOREIGN KEY (team_id) REFERENCES team(team_id),
      CONSTRAINT ticket_slug_unique UNIQUE (ticket_slug),
      CONSTRAINT ticket_slug_format_chk CHECK (ticket_slug ~ '^[0-9]{8}$')
    );

    CREATE INDEX ticket_team_idx ON ticket(team_id);
    CREATE INDEX ticket_priority_idx ON ticket(priority);
    CREATE INDEX ticket_active_team_status_idx
      ON ticket(team_id, status, create_date DESC)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_active_status_idx
      ON ticket(status, create_date DESC)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_open_team_idx
      ON ticket(team_id, create_date DESC)
      WHERE record_end_date IS NULL AND status = 'open';

    COMMENT ON TABLE ticket IS 'Coordination ticket for admin actions requiring review. Each ticket has a unique slug and URL. Access controlled by team membership - team members and system admins can view.';
    COMMENT ON COLUMN ticket.ticket_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket.ticket_slug IS '8-digit slug in DDDNNNNN format where DDD is UTC day-of-year and NNNNN is per-day sequence.';
    COMMENT ON COLUMN ticket.subject IS 'Brief title describing the ticket purpose.';
    COMMENT ON COLUMN ticket.description IS 'Detailed description of what this ticket is for.';
    COMMENT ON COLUMN ticket.team_id IS 'Foreign key to the team. Determines access control - team members and system admins can view this ticket.';
    COMMENT ON COLUMN ticket.priority IS 'Priority level: low, medium, high, critical.';
    COMMENT ON COLUMN ticket.status IS 'Authoritative lifecycle state of the ticket.';
    COMMENT ON COLUMN ticket.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET STATUS (Immutable append-only status transition log)
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_status (
      ticket_status_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      status ticket_status_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_status_pk PRIMARY KEY (ticket_status_id),
      CONSTRAINT ticket_status_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id)
    );

    CREATE INDEX ticket_status_ticket_date_idx
      ON ticket_status(ticket_id, create_date DESC);

    COMMENT ON TABLE ticket_status IS 'Immutable append-only log of ticket status transitions.';
    COMMENT ON COLUMN ticket_status.ticket_status_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_status.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_status.status IS 'Ticket status after the transition.';
    COMMENT ON COLUMN ticket_status.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_status.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_status.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_status.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_status.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_status.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET COMMENT (Links tickets to comments)
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
      CONSTRAINT ticket_comment_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_comment_comment_fk FOREIGN KEY (comment_id) REFERENCES comment(comment_id)
    );

    CREATE INDEX ticket_comment_ticket_idx ON ticket_comment(ticket_id);
    CREATE INDEX ticket_comment_comment_idx ON ticket_comment(comment_id);
    CREATE INDEX ticket_comment_create_date_idx ON ticket_comment(create_date);
    CREATE INDEX ticket_comment_active_ticket_date_idx
      ON ticket_comment(ticket_id, create_date ASC)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE ticket_comment IS 'Links tickets to comments for discussion threads. Comments appear in ticket timeline.';
    COMMENT ON COLUMN ticket_comment.ticket_comment_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_comment.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_comment.comment_id IS 'Foreign key to the comment.';
    COMMENT ON COLUMN ticket_comment.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_comment.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_comment.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_comment.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_comment.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_comment.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- TICKET REFERENCE (Cross-references between tickets)
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_reference (
      ticket_reference_id uuid DEFAULT gen_random_uuid() NOT NULL,
      source_ticket_id uuid NOT NULL,
      target_ticket_id uuid NOT NULL,
      relationship ticket_relationship_type NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_reference_pk PRIMARY KEY (ticket_reference_id),
      CONSTRAINT ticket_reference_source_fk FOREIGN KEY (source_ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_reference_target_fk FOREIGN KEY (target_ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_reference_no_self_reference CHECK (source_ticket_id <> target_ticket_id)
    );

    CREATE INDEX ticket_reference_source_idx ON ticket_reference(source_ticket_id);
    CREATE INDEX ticket_reference_target_idx ON ticket_reference(target_ticket_id);
    CREATE INDEX ticket_reference_active_source_date_idx
      ON ticket_reference(source_ticket_id, create_date ASC)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_reference_active_target_date_idx
      ON ticket_reference(target_ticket_id, create_date ASC)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_reference_relationship_idx ON ticket_reference(relationship);
    CREATE UNIQUE INDEX ticket_reference_active_unique_idx
      ON ticket_reference(source_ticket_id, target_ticket_id, relationship)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE ticket_reference IS 'Directional relationships between tickets showing how tickets relate to each other.';
    COMMENT ON COLUMN ticket_reference.ticket_reference_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_reference.source_ticket_id IS 'The source ticket in the relationship.';
    COMMENT ON COLUMN ticket_reference.target_ticket_id IS 'The target ticket in the relationship.';
    COMMENT ON COLUMN ticket_reference.relationship IS 'The type of relationship from source to target (e.g., source blocks target, source duplicates target).';
    COMMENT ON COLUMN ticket_reference.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_reference.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_reference.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_reference.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_reference.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_reference.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_ticket
      BEFORE INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket
      AFTER INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_status
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_status
      AFTER INSERT OR UPDATE OR DELETE ON ticket_status
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_comment
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_comment
      AFTER INSERT OR UPDATE OR DELETE ON ticket_comment
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_reference
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_reference
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_reference
      AFTER INSERT OR UPDATE OR DELETE ON ticket_reference
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop audit and journal triggers
    DROP TRIGGER IF EXISTS journal_ticket_status ON ticket_status;
    DROP TRIGGER IF EXISTS audit_ticket_status ON ticket_status;
    DROP TRIGGER IF EXISTS journal_ticket_reference ON ticket_reference;
    DROP TRIGGER IF EXISTS audit_ticket_reference ON ticket_reference;
    DROP TRIGGER IF EXISTS journal_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS audit_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS journal_ticket ON ticket;
    DROP TRIGGER IF EXISTS audit_ticket ON ticket;

    -- Drop indexes
    DROP INDEX IF EXISTS ticket_reference_active_unique_idx;
    DROP INDEX IF EXISTS ticket_reference_relationship_idx;
    DROP INDEX IF EXISTS ticket_reference_active_target_date_idx;
    DROP INDEX IF EXISTS ticket_reference_active_source_date_idx;
    DROP INDEX IF EXISTS ticket_reference_target_idx;
    DROP INDEX IF EXISTS ticket_reference_source_idx;
    DROP INDEX IF EXISTS ticket_comment_active_ticket_date_idx;
    DROP INDEX IF EXISTS ticket_comment_create_date_idx;
    DROP INDEX IF EXISTS ticket_comment_comment_idx;
    DROP INDEX IF EXISTS ticket_comment_ticket_idx;
    DROP INDEX IF EXISTS ticket_status_ticket_date_idx;
    DROP INDEX IF EXISTS ticket_active_status_idx;
    DROP INDEX IF EXISTS ticket_open_team_idx;
    DROP INDEX IF EXISTS ticket_active_team_status_idx;
    DROP INDEX IF EXISTS ticket_priority_idx;
    DROP INDEX IF EXISTS ticket_team_idx;

    -- Drop tables
    DROP TABLE IF EXISTS ticket_status;

    -- Drop ticket tables
    ALTER TABLE ticket DROP COLUMN IF EXISTS status;
    ALTER TABLE ticket DROP COLUMN IF EXISTS ticket_slug;
    DROP TABLE IF EXISTS ticket_reference;
    DROP TABLE IF EXISTS ticket_comment;
    DROP TABLE IF EXISTS ticket;

    -- Drop all enums
    DROP TYPE IF EXISTS ticket_status_type;
    DROP TYPE IF EXISTS ticket_relationship_type;
    DROP TYPE IF EXISTS ticket_priority;

  `);
}
