import { Knex } from 'knex';

/**
 * Allow users to belong to multiple contributors while retaining active pair uniqueness.
 * @param knex - Migration database connection.
 * @returns Completion of the index removal.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX contributor_system_uk2;
  `);
}

/**
 * Restore the single-contributor constraint. Fails without deleting data if users have multiple memberships.
 * @param knex - Migration database connection.
 * @returns Completion of the index restoration.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE UNIQUE INDEX contributor_system_uk2
      ON contributor_system_user (system_user_id)
      WHERE record_end_date IS NULL;
  `);
}
