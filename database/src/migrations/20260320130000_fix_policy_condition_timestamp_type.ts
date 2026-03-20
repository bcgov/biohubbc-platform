import { Knex } from 'knex';

// Historical migration kept for migration-chain compatibility.
// Trigger-based policy validation has been removed in 20260320140000.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;
  `);
}
