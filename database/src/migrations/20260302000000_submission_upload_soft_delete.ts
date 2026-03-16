import { Knex } from 'knex';

/**
 * Add record_end_date column to submission_upload to support soft-delete.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload ADD COLUMN record_end_date timestamptz(6);

    COMMENT ON COLUMN submission_upload.record_end_date IS 'The datetime the record was soft-deleted. NULL indicates the record is active.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload DROP COLUMN IF EXISTS record_end_date;
  `);
}
