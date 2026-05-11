import { Knex } from 'knex';
import { rebuildMaterializedViews } from '../materialized-views';

/**
 * Creating materialised views for telemetry and observations datasets to be replicated in the BC Geographic Warehouse.
 * Now uses the new config-driven framework.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  // Rebuild all materialized views from configuration
  await rebuildMaterializedViews(knex, false);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.telemetry_all;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.telemetry_public;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.observations_public;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.observations_all;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.incidental_public;
  `);
  await knex.raw(`
    DROP MATERIALIZED VIEW IF EXISTS bcgw.incidental_all;
  `);
}
