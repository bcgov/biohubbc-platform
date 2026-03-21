import { Knex } from 'knex';

/**
 * Drop policy condition key validation trigger/function.
 *
 * The trigger implementation does not recognize newer property type names (for example: timestamp),
 * which breaks seed inserts into policy_statement_condition.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS validate_policy_condition_key ON biohub.policy_statement_condition;
    DROP FUNCTION IF EXISTS biohub.tr_validate_policy_condition_key();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- No-op: restoring the previous trigger/function would require reintroducing the legacy
    -- validation implementation from 20250911100300_access_policies.
  `);
}
