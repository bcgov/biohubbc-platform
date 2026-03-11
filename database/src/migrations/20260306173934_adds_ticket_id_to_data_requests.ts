import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE "data_request" ADD COLUMN ticket_id uuid NOT NULL;

    COMMENT ON COLUMN data_request.ticket_id IS 'Foreign key to the ticket associated with this data request.';

    ALTER TABLE data_request ADD CONSTRAINT data_request_ticket_fk
      FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id);

    CREATE INDEX data_request_ticket_idx ON data_request(ticket_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS data_request_ticket_idx;

    ALTER TABLE data_request DROP CONSTRAINT IF EXISTS data_request_ticket_fk;

    ALTER TABLE data_request DROP COLUMN IF EXISTS ticket_id;
  `);
}
