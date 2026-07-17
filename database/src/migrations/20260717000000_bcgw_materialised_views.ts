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
  await knex.raw(`
    SET search_path = biohub, public;

    CREATE OR REPLACE FUNCTION biohub.try_geom_from_geojson(geojson_text text)
    RETURNS geometry
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $fn$
    BEGIN
      RETURN public.ST_GeomFromGeoJSON(geojson_text);
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    $fn$;
  `);

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
