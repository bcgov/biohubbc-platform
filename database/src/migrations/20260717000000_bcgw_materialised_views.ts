import { Knex } from 'knex';
import { BCGW_SCHEMA } from './20260717000000_bcgw_materialised_views/config';
import { rebuildMaterialisedView } from './20260717000000_bcgw_materialised_views/lifecycle';
import { MATERIALISED_VIEW_NAMES, VIEW_SQL } from './20260717000000_bcgw_materialised_views/views';

const DB_USER_BCGW_PASS = process.env.DB_USER_BCGW_PASS;
const DB_USER_BCGW = process.env.DB_USER_BCGW;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    -- ----------------------------------------------------------------------------------------
    -- 1. Create BCGW schema
    -- ----------------------------------------------------------------------------------------
    CREATE SCHEMA bcgw;

    -- ----------------------------------------------------------------------------------------
    -- 2. Create BCGW user and grant access
    -- ----------------------------------------------------------------------------------------
    CREATE ROLE ${DB_USER_BCGW} LOGIN PASSWORD '${DB_USER_BCGW_PASS}';
    GRANT USAGE ON SCHEMA bcgw TO ${DB_USER_BCGW};
    ALTER ROLE ${DB_USER_BCGW} SET search_path TO bcgw;

    -- Grant the BCGW user access to future tables, views, and materialised views.
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    GRANT SELECT ON TABLES TO ${DB_USER_BCGW};
  `);

  await knex.raw(`
    -- ----------------------------------------------------------------------------------------
    -- Create the shared safe GeoJSON conversion function
    -- ----------------------------------------------------------------------------------------
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

  for (const view of VIEW_SQL) {
    await rebuildMaterialisedView(knex, view);
  }
}

// ----------------------------------------------------------------------------------------
// Revert migration: remove materialised views, BCGW schema, and BCGW user
// ----------------------------------------------------------------------------------------
export async function down(knex: Knex): Promise<void> {
  for (const viewName of [...MATERIALISED_VIEW_NAMES].reverse()) {
    await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${viewName};`);
    await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS ${BCGW_SCHEMA}.${viewName}_new;`);
  }

  await knex.raw(`
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    REVOKE SELECT ON TABLES FROM ${DB_USER_BCGW};

    DROP SCHEMA IF EXISTS bcgw CASCADE;
    DROP USER IF EXISTS ${DB_USER_BCGW};
  `);
}
