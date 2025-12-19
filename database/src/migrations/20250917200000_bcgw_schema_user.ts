import { Knex } from 'knex';

const DB_USER_BCGW_PASS = process.env.DB_USER_BCGW_PASS;
const DB_USER_BCGW = process.env.DB_USER_BCGW;

/**
 * Create bcgw schema and user.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    -- set up bcgw schema
    create schema bcgw;

    -- setup bcgw user
    create role ${DB_USER_BCGW} login password '${DB_USER_BCGW_PASS}';
    GRANT USAGE ON SCHEMA bcgw TO ${DB_USER_BCGW};
    alter role ${DB_USER_BCGW} set search_path to bcgw;

    -- alter default privileges for the schema owner so that bcgw user is granted access to all future tables, views, and materialized views
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    GRANT SELECT ON TABLES TO ${DB_USER_BCGW};
  `);
}

/**
 * Revert changes for bcgw schema and user.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    -- revert default privileges for the schema owner
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA bcgw
    REVOKE SELECT ON TABLES FROM ${DB_USER_BCGW};

    -- drop bcgw user and schema
    DROP SCHEMA IF EXISTS bcgw CASCADE;
    DROP USER IF EXISTS ${DB_USER_BCGW};
  `);
}
