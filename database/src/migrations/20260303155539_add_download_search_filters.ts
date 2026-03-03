import { Knex } from 'knex';

/**
 * Add search_filters JSONB column to the download table.
 * Null for cart-based downloads (no search filter context exists).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download ADD COLUMN search_filters JSONB;

    COMMENT ON COLUMN download.search_filters IS 'Original search filters used to create this download. Null for cart-based downloads.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download DROP COLUMN IF EXISTS search_filters;
  `);
}
