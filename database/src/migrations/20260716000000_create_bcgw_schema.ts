import type { Knex } from 'knex';

/** Create BCGW infrastructure before either family of materialised views. */
export async function up(knex: Knex): Promise<void> {
  const { DB_USER_BCGW, DB_USER_BCGW_PASS } = process.env;
  if (!DB_USER_BCGW || !DB_USER_BCGW_PASS) {
    throw new Error('DB_USER_BCGW and DB_USER_BCGW_PASS are required for BCGW setup.');
  }
  const role = knex.ref(DB_USER_BCGW).toQuery();
  await knex.raw(`--sql
    -- ----------------------------------------------------------------------------------------
    -- 1. Create BCGW schema
    -- ----------------------------------------------------------------------------------------
    CREATE SCHEMA bcgw;
    CREATE SCHEMA bcgw_internal;
    REVOKE ALL ON SCHEMA bcgw_internal FROM PUBLIC;

    -- ----------------------------------------------------------------------------------------
    -- 2. Create BCGW user and grant access
    -- ----------------------------------------------------------------------------------------
    CREATE ROLE ${role} LOGIN PASSWORD '${DB_USER_BCGW_PASS.replace(/'/g, "''")}';
    GRANT USAGE ON SCHEMA bcgw TO ${role};
    ALTER ROLE ${role} SET search_path TO bcgw;

    -- Grant the BCGW user access to future tables, views, and materialised views.
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    GRANT SELECT ON TABLES TO ${role};
  `);
}

/** Run after both domain rollbacks; leave unrelated biohub functions untouched. */
export async function down(knex: Knex): Promise<void> {
  const { DB_USER_BCGW } = process.env;
  if (!DB_USER_BCGW) {
    throw new Error('DB_USER_BCGW is required for BCGW rollback.');
  }
  const role = knex.ref(DB_USER_BCGW).toQuery();
  await knex.raw(`--sql
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    REVOKE SELECT ON TABLES FROM ${role};

    DROP SCHEMA IF EXISTS bcgw;
    DROP SCHEMA IF EXISTS bcgw_internal;
    DROP USER IF EXISTS ${role};

    -- biohub.try_geom_from_geojson is also managed by procedures/01_try_geom_from_geojson.ts.
    -- Preserve it, as the original BCGW migration did.
  `);
}
