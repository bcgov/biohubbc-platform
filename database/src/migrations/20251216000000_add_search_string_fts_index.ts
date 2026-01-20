import { Knex } from 'knex';

/**
 * Add GIN index for full-text search on search_string.value (SIMSBIOHUB-830).
 *
 * This index enables efficient full-text search queries using to_tsvector/to_tsquery.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Add GIN index for full-text search on search_string.value
    --------------------------------------------------------------------------------
    CREATE INDEX search_string_fts_idx
      ON search_string
      USING GIN (to_tsvector('english', value));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Remove GIN index for full-text search
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS search_string_fts_idx;
  `);
}
