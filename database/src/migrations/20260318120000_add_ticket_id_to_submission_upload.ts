import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload ADD COLUMN ticket_id uuid NOT NULL;

    COMMENT ON COLUMN submission_upload.ticket_id IS 'Foreign key to the ticket associated with this submission upload.';

    ALTER TABLE submission_upload ADD CONSTRAINT submission_upload_ticket_fk
      FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id);

    CREATE INDEX submission_upload_ticket_idx ON submission_upload(ticket_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_ticket_idx;

    ALTER TABLE submission_upload DROP CONSTRAINT IF EXISTS submission_upload_ticket_fk;

    ALTER TABLE submission_upload DROP COLUMN IF EXISTS ticket_id;
  `);
}
