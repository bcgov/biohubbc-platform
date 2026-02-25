import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ENUMS (All type definitions at the top)
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

    COMMENT ON TYPE ticket_relationship_type IS 'Type of relationship between tickets: blocks (source blocks target), blocked_by (source is blocked by target), duplicates (source duplicates target), duplicate_of (source is duplicate of target), relates_to (general reference), resolves (source resolves target), resolved_by (source is resolved by target).';

    CREATE TYPE ticket_status AS ENUM (
      'open',
      'closed'
    );

    COMMENT ON TYPE ticket_status IS 'Lifecycle status for tickets (open or closed).';

    CREATE TYPE decision_type AS ENUM (
      'approved',
      'denied',
      'pending'
    );

    COMMENT ON TYPE decision_type IS 'Decision status for admin-reviewed entities.';

    -- TICKET
    --------------------------------------------------------------------------------

    CREATE TABLE ticket (
      ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_slug varchar(8) NOT NULL,
      title varchar(100) NOT NULL,
      description varchar(2000) NULL,
      team_id uuid NOT NULL,
      priority ticket_priority NOT NULL DEFAULT 'medium',
      status ticket_status NOT NULL DEFAULT 'open',
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
    CREATE INDEX ticket_open_team_idx
      ON ticket(team_id, create_date DESC)
      WHERE record_end_date IS NULL AND status = 'open';

    COMMENT ON TABLE ticket IS 'Coordination ticket for admin actions requiring review. Each ticket has a unique slug and URL. Access controlled by team membership - team members and system admins can view.';
    COMMENT ON COLUMN ticket.ticket_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket.ticket_slug IS '8-digit slug in DDDNNNNN format where DDD is UTC day-of-year and NNNNN is per-day sequence.';
    COMMENT ON COLUMN ticket.title IS 'Brief title describing the ticket purpose.';
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
    -- TICKET STATUS HISTORY (Immutable append-only status transition log)
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_status_history (
      ticket_status_history_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      status ticket_status NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_status_history_pk PRIMARY KEY (ticket_status_history_id),
      CONSTRAINT ticket_status_history_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id)
    );

    CREATE INDEX ticket_status_history_ticket_date_idx
      ON ticket_status_history(ticket_id, create_date DESC);

    COMMENT ON TABLE ticket_status_history IS 'Immutable append-only log of ticket status transitions.';
    COMMENT ON COLUMN ticket_status_history.ticket_status_history_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_status_history.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_status_history.status IS 'Ticket status after the transition.';
    COMMENT ON COLUMN ticket_status_history.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_status_history.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_status_history.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_status_history.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_status_history.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_status_history.revision_count IS 'Revision count used for concurrency control.';

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
    -- TICKET DECISION HISTORY
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_decision (
      ticket_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      decision decision_type NOT NULL,
      comment_id uuid,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_decision_pk PRIMARY KEY (ticket_decision_id),
      CONSTRAINT ticket_decision_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_decision_comment_fk FOREIGN KEY (comment_id) REFERENCES comment(comment_id)
    );

    CREATE INDEX ticket_decision_ticket_idx ON ticket_decision(ticket_id);
    CREATE INDEX ticket_decision_decision_idx ON ticket_decision(decision);
    CREATE INDEX ticket_decision_create_date_idx ON ticket_decision(create_date);
    CREATE UNIQUE INDEX ticket_decision_one_active_idx
      ON ticket_decision(ticket_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_decision_active_latest_idx
      ON ticket_decision(ticket_id, create_date DESC)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE ticket_decision IS 'Links tickets to admin decisions. Provides history of all decisions made on a ticket. Most commonly used for final ticket resolution decisions.';
    COMMENT ON COLUMN ticket_decision.ticket_decision_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_decision.ticket_id IS 'Foreign key to the ticket.';
    COMMENT ON COLUMN ticket_decision.decision IS 'Decision made for this ticket: approved, denied, or pending.';
    COMMENT ON COLUMN ticket_decision.comment_id IS 'Optional comment explaining the decision.';
    COMMENT ON COLUMN ticket_decision.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN ticket_decision.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_decision.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_decision.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_decision.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_decision.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DATA REQUEST DECISION HISTORY
    --------------------------------------------------------------------------------

    CREATE TABLE data_request_decision (
      data_request_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
      data_request_id uuid NOT NULL,
      decision decision_type NOT NULL,
      comment_id uuid,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT data_request_decision_pk PRIMARY KEY (data_request_decision_id),
      CONSTRAINT data_request_decision_data_request_fk FOREIGN KEY (data_request_id) REFERENCES data_request(data_request_id),
      CONSTRAINT data_request_decision_comment_fk FOREIGN KEY (comment_id) REFERENCES comment(comment_id)
    );

    CREATE INDEX data_request_decision_data_request_idx ON data_request_decision(data_request_id);
    CREATE INDEX data_request_decision_decision_idx ON data_request_decision(decision);
    CREATE INDEX data_request_decision_create_date_idx ON data_request_decision(create_date);
    CREATE UNIQUE INDEX data_request_decision_one_active_idx
      ON data_request_decision(data_request_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX data_request_decision_active_latest_idx
      ON data_request_decision(data_request_id, create_date DESC)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE data_request_decision IS 'Links data requests to admin decisions. Provides history of all decisions made on a data request. Status is derived from the most recent decision.';
    COMMENT ON COLUMN data_request_decision.data_request_decision_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN data_request_decision.data_request_id IS 'Foreign key to the data request.';
    COMMENT ON COLUMN data_request_decision.decision IS 'Decision made for this data request: approved, denied, or pending.';
    COMMENT ON COLUMN data_request_decision.comment_id IS 'Optional comment explaining the decision.';
    COMMENT ON COLUMN data_request_decision.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN data_request_decision.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN data_request_decision.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN data_request_decision.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN data_request_decision.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN data_request_decision.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- SUBMISSION UPLOAD DECISION HISTORY
    --------------------------------------------------------------------------------

    CREATE TABLE submission_upload_decision (
      submission_upload_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
      submission_upload_id uuid NOT NULL,
      decision decision_type NOT NULL,
      comment_id uuid,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_decision_pk PRIMARY KEY (submission_upload_decision_id),
      CONSTRAINT submission_upload_decision_submission_upload_fk FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_decision_comment_fk FOREIGN KEY (comment_id) REFERENCES comment(comment_id)
    );

    CREATE INDEX submission_upload_decision_submission_upload_idx ON submission_upload_decision(submission_upload_id);
    CREATE INDEX submission_upload_decision_decision_idx ON submission_upload_decision(decision);
    CREATE INDEX submission_upload_decision_create_date_idx ON submission_upload_decision(create_date);
    CREATE UNIQUE INDEX submission_upload_decision_one_active_idx
      ON submission_upload_decision(submission_upload_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX submission_upload_decision_active_latest_idx
      ON submission_upload_decision(submission_upload_id, create_date DESC)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE submission_upload_decision IS 'Links submission uploads to admin decisions. Provides history of all decisions made on a submission upload. Status is derived from the most recent decision.';
    COMMENT ON COLUMN submission_upload_decision.submission_upload_decision_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload_decision.submission_upload_id IS 'Foreign key to the submission upload.';
    COMMENT ON COLUMN submission_upload_decision.decision IS 'Decision made for this submission upload: approved, denied, or pending.';
    COMMENT ON COLUMN submission_upload_decision.comment_id IS 'Optional comment explaining the decision.';
    COMMENT ON COLUMN submission_upload_decision.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN submission_upload_decision.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload_decision.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload_decision.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_upload_decision.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_upload_decision.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD DECISION HISTORY (for future use)
    --------------------------------------------------------------------------------

    -- Uncomment when download table exists and needs decision tracking
    -- CREATE TABLE download_decision (
    --   download_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
    --   download_id uuid NOT NULL,
    --   decision decision_type NOT NULL,
    --   comment_id uuid,
    --   record_end_date timestamptz(6),
    --   create_date timestamptz(6) DEFAULT now() NOT NULL,
    --   create_user integer NOT NULL,
    --   update_date timestamptz(6),
    --   update_user integer,
    --   revision_count integer DEFAULT 0 NOT NULL,
    --   CONSTRAINT download_decision_pk PRIMARY KEY (download_decision_id),
    --   CONSTRAINT download_decision_download_fk FOREIGN KEY (download_id) REFERENCES download(download_id),
    --   CONSTRAINT download_decision_comment_fk FOREIGN KEY (comment_id) REFERENCES comment(comment_id)
    -- );
    --
    -- CREATE INDEX download_decision_download_idx ON download_decision(download_id);
    -- CREATE INDEX download_decision_decision_idx ON download_decision(decision);
    -- CREATE INDEX download_decision_create_date_idx ON download_decision(create_date);
    --
    -- COMMENT ON TABLE download_decision IS 'Links downloads to admin decisions. Provides history of all decisions made on a download. Status is derived from the most recent decision.';
    -- COMMENT ON COLUMN download_decision.download_decision_id IS 'System generated surrogate primary key identifier.';
    -- COMMENT ON COLUMN download_decision.download_id IS 'Foreign key to the download.';
    -- COMMENT ON COLUMN download_decision.decision IS 'Decision made for this download: approved, denied, or pending.';
    -- COMMENT ON COLUMN download_decision.comment_id IS 'Optional comment explaining the decision.';
    -- COMMENT ON COLUMN download_decision.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    -- COMMENT ON COLUMN download_decision.create_date IS 'The datetime the record was created.';
    -- COMMENT ON COLUMN download_decision.create_user IS 'The id of the user who created the record.';
    -- COMMENT ON COLUMN download_decision.update_date IS 'The datetime the record was last updated.';
    -- COMMENT ON COLUMN download_decision.update_user IS 'The id of the user who last updated the record.';
    -- COMMENT ON COLUMN download_decision.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_ticket
      BEFORE INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket
      AFTER INSERT OR UPDATE OR DELETE ON ticket
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_ticket_status_history
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_status_history
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_status_history
      AFTER INSERT OR UPDATE OR DELETE ON ticket_status_history
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

    CREATE TRIGGER audit_ticket_decision
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_decision
      AFTER INSERT OR UPDATE OR DELETE ON ticket_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_data_request_decision
      BEFORE INSERT OR UPDATE OR DELETE ON data_request_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_data_request_decision
      AFTER INSERT OR UPDATE OR DELETE ON data_request_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_submission_upload_decision
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_upload_decision
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_decision
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop audit and journal triggers
    DROP TRIGGER IF EXISTS journal_submission_upload_decision ON submission_upload_decision;
    DROP TRIGGER IF EXISTS audit_submission_upload_decision ON submission_upload_decision;
    DROP TRIGGER IF EXISTS journal_data_request_decision ON data_request_decision;
    DROP TRIGGER IF EXISTS audit_data_request_decision ON data_request_decision;
    DROP TRIGGER IF EXISTS journal_ticket_decision ON ticket_decision;
    DROP TRIGGER IF EXISTS audit_ticket_decision ON ticket_decision;
    DROP TRIGGER IF EXISTS journal_ticket_status_history ON ticket_status_history;
    DROP TRIGGER IF EXISTS audit_ticket_status_history ON ticket_status_history;
    DROP TRIGGER IF EXISTS journal_ticket_reference ON ticket_reference;
    DROP TRIGGER IF EXISTS audit_ticket_reference ON ticket_reference;
    DROP TRIGGER IF EXISTS journal_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS audit_ticket_comment ON ticket_comment;
    DROP TRIGGER IF EXISTS journal_ticket ON ticket;
    DROP TRIGGER IF EXISTS audit_ticket ON ticket;

    -- Drop indexes added for decision lookup and list/timeline queries
    DROP INDEX IF EXISTS submission_upload_decision_one_active_idx;
    DROP INDEX IF EXISTS submission_upload_decision_active_latest_idx;
    DROP INDEX IF EXISTS submission_upload_decision_decision_idx;
    DROP INDEX IF EXISTS data_request_decision_one_active_idx;
    DROP INDEX IF EXISTS data_request_decision_active_latest_idx;
    DROP INDEX IF EXISTS data_request_decision_decision_idx;
    DROP INDEX IF EXISTS ticket_decision_one_active_idx;
    DROP INDEX IF EXISTS ticket_decision_active_latest_idx;
    DROP INDEX IF EXISTS ticket_decision_decision_idx;
    DROP INDEX IF EXISTS ticket_status_history_ticket_date_idx;
    DROP INDEX IF EXISTS ticket_open_team_idx;
    DROP INDEX IF EXISTS ticket_active_team_status_idx;

    -- Drop FKs added in this migration
    ALTER TABLE submission_upload_decision DROP CONSTRAINT IF EXISTS submission_upload_decision_comment_fk;
    ALTER TABLE data_request_decision DROP CONSTRAINT IF EXISTS data_request_decision_comment_fk;
    ALTER TABLE ticket_decision DROP CONSTRAINT IF EXISTS ticket_decision_comment_fk;

    -- Drop decision tables
    DROP TABLE IF EXISTS submission_upload_decision;
    DROP TABLE IF EXISTS data_request_decision;
    DROP TABLE IF EXISTS ticket_decision;
    DROP TABLE IF EXISTS ticket_status_history;

    -- Drop ticket tables
    ALTER TABLE ticket DROP COLUMN IF EXISTS status;
    ALTER TABLE ticket DROP COLUMN IF EXISTS ticket_slug;
    DROP TABLE IF EXISTS ticket_reference;
    DROP TABLE IF EXISTS ticket_comment;
    DROP TABLE IF EXISTS ticket;

    -- Drop all enums
    DROP TYPE IF EXISTS decision_type;
    DROP TYPE IF EXISTS ticket_status;
    DROP TYPE IF EXISTS ticket_relationship_type;
    DROP TYPE IF EXISTS ticket_priority;

  `);
}
