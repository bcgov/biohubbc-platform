import * as fs from 'fs';
import { Knex } from 'knex';
import path from 'path';

const DB_USER_API_PASS = process.env.DB_USER_API_PASS;
const DB_USER_API = process.env.DB_USER_API;

const DB_RELEASE = 'release.0.1.0';

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
  const api_set_context = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_set_context.sql'));

  const tr_audit_trigger = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'tr_audit_trigger.sql'));
  const tr_generated_audit_triggers = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'tr_generated_audit_triggers.sql')
  );
  const api_get_context_user_id = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_get_context_user_id.sql'));
  const api_get_context_system_user_role_id = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'api_get_context_system_user_role_id.sql')
  );
  const tr_journal_trigger = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'tr_journal_trigger.sql'));
  const tr_generated_journal_triggers = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'tr_generated_journal_triggers.sql')
  );
  const api_get_system_constant = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'api_get_system_constant.sql'));
  const api_get_system_metadata_constant = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'api_get_system_metadata_constant.sql')
  );

  const populate_system_constants = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'populate_system_constant.sql'));
  const populate_system_role = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'populate_system_role.sql'));
  const populate_system_metadata_constant = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_system_metadata_constant.sql')
  );
  const populate_submission_status_type = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_submission_status_type.sql')
  );
  const populate_submission_message_class = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_submission_message_class.sql')
  );
  const populate_submission_message_type = fs.readFileSync(
    path.join(__dirname, DB_RELEASE, 'populate_submission_message_type.sql')
  );

  const vw_generated_dapi_views = fs.readFileSync(path.join(__dirname, DB_RELEASE, 'vw_generated_dapi_views.sql'));

  await knex.raw(`
    -- set up spatial extensions
    ${create_spatial_extensions}

    -- set up biohub schema
    create schema if not exists biohub;
    GRANT ALL ON SCHEMA biohub TO postgres;
    set search_path = biohub, public;

    -- setup biohub api schema
    create schema if not exists biohub_dapi_v1;

    -- setup api user
    create user ${DB_USER_API} password '${DB_USER_API_PASS}';
    alter schema biohub_dapi_v1 owner to ${DB_USER_API};

    -- Grant rights on biohub_dapi_v1 to biohub_api user
    grant all on schema biohub_dapi_v1 to ${DB_USER_API};
    grant all on schema biohub_dapi_v1 to postgres;
    alter DEFAULT PRIVILEGES in SCHEMA biohub_dapi_v1 grant ALL on tables to ${DB_USER_API};
    alter DEFAULT PRIVILEGES in SCHEMA biohub_dapi_v1 grant ALL on tables to postgres;

    -- biohub grants
    GRANT USAGE ON SCHEMA biohub TO ${DB_USER_API};
    ALTER DEFAULT PRIVILEGES IN SCHEMA biohub GRANT ALL ON TABLES TO ${DB_USER_API};

    alter role ${DB_USER_API} set search_path to biohub_dapi_v1, biohub, public, topology;

    ${biohub_ddl}
    ${populate_user_identity_source}
    ${api_set_context}
    ${tr_audit_trigger}
    ${tr_generated_audit_triggers}
    ${api_get_context_user_id}
    ${api_get_context_system_user_role_id}
    ${tr_journal_trigger}
    ${tr_generated_journal_triggers}
    ${api_get_system_constant}
    ${api_get_system_metadata_constant}

    -- populate look up tables
    set search_path = biohub, public;
    ${populate_system_constants}
    ${populate_system_role}
    ${populate_system_metadata_constant}
    ${populate_submission_status_type}
    ${populate_submission_message_class}
    ${populate_submission_message_type}


    -- create the views
    set search_path = biohub_dapi_v1;
    set role biohub_api;
    ${vw_generated_dapi_views}

    set role postgres;
    set search_path = biohub;
    grant execute on function biohub.api_set_context(_system_user_identifier system_user.user_identifier%type, _user_identity_source_name user_identity_source.name%type) to ${DB_USER_API};
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP SCHEMA IF EXISTS biohub CASCADE;
    DROP SCHEMA IF EXISTS biohub_dapi_v1 CASCADE;
    DROP USER IF EXISTS ${DB_USER_API};
  `);
}
