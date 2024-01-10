import * as fs from 'fs';
import { Knex } from 'knex';
import path from 'path';

const DB_USER_API_PASS = process.env.DB_USER_API_PASS;
const DB_USER_API = process.env.DB_USER_API;

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

  const biohub_ddl = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'biohub.sql'));
  const populate_user_identity_source = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_user_identity_source.sql')
  );
  const populate_system_user = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'populate_system_user.sql'));
  const api_set_context = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_set_context.sql'));

  const tr_audit_trigger = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'tr_audit_trigger.sql'));
  const tr_generated_audit_triggers = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'tr_generated_audit_triggers.sql')
  );
  const api_get_context_user_id = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_get_context_user_id.sql'));
  const tr_journal_trigger = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'tr_journal_trigger.sql'));
  const tr_generated_journal_triggers = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'tr_generated_journal_triggers.sql')
  );
  const api_get_system_constant = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_get_system_constant.sql'));
  const api_get_system_metadata_constant = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'api_get_system_metadata_constant.sql')
  );
  const create_sequences = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'create_sequences.sql'));

  const populate_system_constants = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'populate_system_constant.sql'));
  const populate_system_role = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'populate_system_role.sql'));
  const populate_system_metadata_constant = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_system_metadata_constant.sql')
  );

  const tr_prevent_publish_before_review = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'tr_prevent_publish_before_review_trigger.sql')
  );

  await knex.raw(`
    -- set up spatial extensions
    ${create_spatial_extensions}

    -- set up biohub schema
    create schema if not exists biohub;
    
    -- setup postgres user
    GRANT ALL ON SCHEMA biohub TO postgres;
    set search_path = biohub, public;

    -- setup biohub_api user
    create user ${DB_USER_API} password '${DB_USER_API_PASS}';
    GRANT USAGE ON SCHEMA biohub TO ${DB_USER_API};
    alter role ${DB_USER_API} set search_path to "$user", biohub, public;

    -- alter default privileges for the biohub_api user so that it is granted access to all future tables/functions/etc
    ALTER DEFAULT PRIVILEGES IN SCHEMA biohub, public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO biohub_api;

    ALTER DEFAULT PRIVILEGES IN SCHEMA biohub, public
    GRANT EXECUTE ON FUNCTIONS TO biohub_api;

    ALTER DEFAULT PRIVILEGES IN SCHEMA biohub, public
    GRANT USAGE ON TYPES TO biohub_api;

    ALTER DEFAULT PRIVILEGES IN SCHEMA biohub, public
    GRANT USAGE, SELECT ON SEQUENCES TO biohub_api;

    -- create tables/triggers/functions/etc
    ${biohub_ddl}
    ${populate_user_identity_source}
    ${populate_system_user}
    ${api_set_context}
    ${tr_audit_trigger}
    ${tr_generated_audit_triggers}
    ${api_get_context_user_id}
    ${tr_journal_trigger}
    ${tr_generated_journal_triggers}
    ${api_get_system_constant}
    ${api_get_system_metadata_constant}
    ${create_sequences}
    ${tr_prevent_publish_before_review}

    -- populate look up tables
    ${populate_system_role}
    ${populate_system_constants}
    ${populate_system_metadata_constant}

    set role postgres;
    set search_path = biohub, public;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP SCHEMA IF EXISTS biohub CASCADE;
    DROP USER IF EXISTS ${DB_USER_API};
  `);
}
