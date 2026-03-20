import { Knex } from 'knex';

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
  `);
}
