import * as fs from 'fs';
import { Knex } from 'knex';
import path from 'path';

const DB_USER_BCGW_PASS = process.env.DB_USER_BCGW_PASS;
const DB_USER_BCGW = process.env.DB_USER_BCGW;

const DB_RELEASE = 'release.0.8.0';

/**
 * Apply biohub-platform release changes.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  const create_spatial_extensions = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'create_spatial_extensions.psql'));

  await knex.raw(`
    -- set up spatial extensions
    ${create_spatial_extensions}

    -- set up bcgw schema
    create schema if not exists bcgw;

    -- setup bcgw user
    create user ${DB_USER_BCGW} password '${DB_USER_BCGW_PASS}';
    GRANT USAGE ON SCHEMA bcgw TO ${DB_USER_BCGW};
    alter role ${DB_USER_BCGW} set search_path to "$user", bcgw, public;

    -- alter default privileges for the schema owner so that bcgw user is granted access to all future materialized views
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    GRANT SELECT ON MATERIALIZED VIEWS TO ${DB_USER_BCGW};
  `);
}

/**
 * Revert biohub-platform release changes for bcgw schema and user.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    -- revert default privileges for the schema owner
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    REVOKE SELECT ON MATERIALIZED VIEWS FROM ${DB_USER_BCGW};

    -- drop bcgw user and schema
    DROP SCHEMA IF EXISTS bcgw CASCADE;
    DROP USER IF EXISTS ${DB_USER_BCGW};
  `);
}
