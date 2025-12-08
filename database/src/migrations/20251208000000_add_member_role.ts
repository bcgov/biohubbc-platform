import { Knex } from 'knex';

/**
 * Migration to support auto-creation of system users on first sign-in (SIMSBIOHUB-838).
 *
 * Adds 'Member' role to system_role table (least privileged role for new users).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Add 'Member' role
    --------------------------------------------------------------------------------
    INSERT INTO system_role (name, record_effective_date, description)
    VALUES ('Member', now(), 'Default role for new users with basic access permissions.');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Remove 'Member' role
    --------------------------------------------------------------------------------
    DELETE FROM system_role WHERE name = 'Member';
  `);
}
