import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- TICKET COMMENT ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE ticket_comment_artifact (
      ticket_comment_artifact_id uuid DEFAULT gen_random_uuid() NOT NULL,
      ticket_comment_id uuid NOT NULL,
      ticket_artifact_id uuid NOT NULL,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT ticket_comment_artifact_pk PRIMARY KEY (ticket_comment_artifact_id),
      CONSTRAINT ticket_comment_artifact_comment_fk FOREIGN KEY (ticket_comment_id) REFERENCES ticket_comment(ticket_comment_id),
      CONSTRAINT ticket_comment_artifact_artifact_fk FOREIGN KEY (ticket_artifact_id) REFERENCES ticket_artifact(ticket_artifact_id)
    );

    CREATE UNIQUE INDEX ticket_comment_artifact_nuk1
      ON ticket_comment_artifact(ticket_comment_id, ticket_artifact_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_comment_artifact_comment_idx
      ON ticket_comment_artifact(ticket_comment_id)
      WHERE record_end_date IS NULL;
    CREATE INDEX ticket_comment_artifact_artifact_idx
      ON ticket_comment_artifact(ticket_artifact_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE ticket_comment_artifact IS 'Associates a ticket comment to the ticket artifacts referenced by its markdown.';
    COMMENT ON COLUMN ticket_comment_artifact.ticket_comment_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN ticket_comment_artifact.ticket_comment_id IS 'Foreign key to the ticket comment containing the artifact reference.';
    COMMENT ON COLUMN ticket_comment_artifact.ticket_artifact_id IS 'Foreign key to the ticket-scoped artifact referenced by the comment.';
    COMMENT ON COLUMN ticket_comment_artifact.record_end_date IS 'Date/time when this ticket comment artifact association was ended (soft delete).';
    COMMENT ON COLUMN ticket_comment_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN ticket_comment_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN ticket_comment_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN ticket_comment_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN ticket_comment_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_ticket_comment_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON ticket_comment_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_ticket_comment_artifact
      AFTER INSERT OR UPDATE OR DELETE ON ticket_comment_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- BACKFILL EXISTING COMMENT ARTIFACT REFERENCES
    --------------------------------------------------------------------------------

    INSERT INTO ticket_comment_artifact (
      ticket_comment_id,
      ticket_artifact_id
    )
    SELECT DISTINCT
      tc.ticket_comment_id,
      ta.ticket_artifact_id
    FROM ticket_comment tc
    JOIN comment c
      ON c.comment_id = tc.comment_id
    CROSS JOIN LATERAL regexp_matches(
      c.comment,
      '!?\\[[^\\]]*\\]\\(/artifact/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\)',
      'gi'
    ) AS refs(ticket_artifact_id_match)
    JOIN ticket_artifact ta
      ON ta.ticket_artifact_id = refs.ticket_artifact_id_match[1]::uuid
      AND ta.ticket_id = tc.ticket_id
      AND ta.record_end_date IS NULL
    WHERE tc.record_end_date IS NULL
    ON CONFLICT DO NOTHING;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_ticket_comment_artifact ON ticket_comment_artifact;
    DROP TRIGGER IF EXISTS audit_ticket_comment_artifact ON ticket_comment_artifact;

    DROP INDEX IF EXISTS ticket_comment_artifact_artifact_idx;
    DROP INDEX IF EXISTS ticket_comment_artifact_comment_idx;
    DROP INDEX IF EXISTS ticket_comment_artifact_nuk1;

    DROP TABLE IF EXISTS ticket_comment_artifact;
  `);
}
