import { Knex } from 'knex';

/**
 * Adds is_active flag to security_rule for enable/disable without soft-delete.
 *
 * Notes:
 * - DEFAULT true backfills existing rules as active.
 * - Inactive rules are excluded from automatic security screening.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE security_rule
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;

    COMMENT ON COLUMN security_rule.is_active IS
      'When false, the rule is excluded from automatic security screening.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE security_rule
      DROP COLUMN IF EXISTS is_active;
  `);
}
