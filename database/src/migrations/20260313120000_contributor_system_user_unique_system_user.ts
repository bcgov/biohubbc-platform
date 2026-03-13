import { Knex } from 'knex';

/**
 * Ensure each system user has at most one active contributor mapping. This allows requests to resolve to a single contributor_id.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE UNIQUE INDEX contributor_system_uk2
      ON contributor_system_user (system_user_id)
      WHERE record_end_date IS NULL;
  `);
}

/**
 * Drop unique active system user -> contributor mapping index.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS contributor_system_uk2;
  `);
}
