import { Knex } from 'knex';

/**
 * Add user profile fields to system_user table.
 *
 * These fields store user profile data from Keycloak tokens:
 * - display_name: Full display name
 * - given_name: First name
 * - family_name: Last name
 * - email: Email address
 * - agency: Organization/business name (BCeID Business only)
 * - notes: Admin notes about the user
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    ALTER TABLE "system_user" ADD COLUMN display_name VARCHAR(100);
    ALTER TABLE "system_user" ADD COLUMN given_name VARCHAR(100);
    ALTER TABLE "system_user" ADD COLUMN family_name VARCHAR(100);
    ALTER TABLE "system_user" ADD COLUMN email VARCHAR(100);
    ALTER TABLE "system_user" ADD COLUMN agency VARCHAR(100);
    ALTER TABLE "system_user" ADD COLUMN notes VARCHAR(250);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    ALTER TABLE "system_user" DROP COLUMN IF EXISTS display_name;
    ALTER TABLE "system_user" DROP COLUMN IF EXISTS given_name;
    ALTER TABLE "system_user" DROP COLUMN IF EXISTS family_name;
    ALTER TABLE "system_user" DROP COLUMN IF EXISTS email;
    ALTER TABLE "system_user" DROP COLUMN IF EXISTS agency;
    ALTER TABLE "system_user" DROP COLUMN IF EXISTS notes;
  `);
}
