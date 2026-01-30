import { Knex } from 'knex';

/**
 * Increase length of s3_upload_id on upload table.
 *
 * This migration:
 * - Expands s3_upload_id from VARCHAR(100) to VARCHAR(500)
 *
 * @export
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path = biohub, public;

    ALTER TABLE upload
      ALTER COLUMN s3_upload_id TYPE VARCHAR(1000);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path = biohub, public;

    ALTER TABLE upload
      ALTER COLUMN s3_upload_id TYPE VARCHAR(100);
  `);
}
