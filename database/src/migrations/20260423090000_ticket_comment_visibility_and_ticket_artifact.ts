import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TICKET ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_artifact (
      ticket_artifact_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL,
      artifact_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_artifact_pk PRIMARY KEY (ticket_artifact_id),
      CONSTRAINT ticket_artifact_ticket_fk FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id),
      CONSTRAINT ticket_artifact_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    CREATE UNIQUE INDEX ticket_artifact_nuk1
      ON ticket_artifact(ticket_id, artifact_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_artifact_ticket_idx
      ON ticket_artifact(ticket_id, create_date)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_artifact_artifact_idx
      ON ticket_artifact(artifact_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_artifact_ticket_artifact_id_idx
      ON ticket_artifact(ticket_id, ticket_artifact_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX artifact_security_artifact_create_date_idx
      ON artifact_security(artifact_id, create_date DESC)
      WHERE record_end_date IS NULL;

    CREATE INDEX upload_artifact_upload_role_active_idx
      ON upload_artifact(upload_id, role)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE ticket_artifact IS 'Associates an artifact to the ticket that owns the attachment.';
    COMMENT ON COLUMN ticket_artifact.ticket_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_artifact.ticket_id IS 'Foreign key to the owning ticket.';
    COMMENT ON COLUMN ticket_artifact.artifact_id IS 'Foreign key to the associated artifact.';
    COMMENT ON COLUMN ticket_artifact.record_end_date IS 'Date/time when this ticket attachment association was ended (soft delete).';
    COMMENT ON COLUMN ticket_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_ticket_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_artifact
      AFTER INSERT OR UPDATE OR DELETE ON ticket_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_ticket_artifact ON ticket_artifact;
    DROP TRIGGER IF EXISTS audit_ticket_artifact ON ticket_artifact;

    DROP INDEX IF EXISTS ticket_artifact_artifact_idx;
    DROP INDEX IF EXISTS ticket_artifact_ticket_artifact_id_idx;
    DROP INDEX IF EXISTS ticket_artifact_ticket_idx;
    DROP INDEX IF EXISTS ticket_artifact_nuk1;
    DROP INDEX IF EXISTS artifact_security_artifact_create_date_idx;
    DROP INDEX IF EXISTS upload_artifact_upload_role_active_idx;

    DROP TABLE IF EXISTS ticket_artifact;

  `);
}
