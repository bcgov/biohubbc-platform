import { Knex } from 'knex';

/**
 * Add unique constraint on user_guid column in system_user table.
 *
 * This ensures one record per Keycloak GUID, supporting the auto-registration
 * feature where expired users remain blocked (not recreated).
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    CREATE UNIQUE INDEX system_user_nuk2 ON "system_user"(user_guid);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    DROP INDEX IF EXISTS system_user_nuk2;
  `);
}
