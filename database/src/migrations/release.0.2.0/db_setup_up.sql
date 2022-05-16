--  db_setup_up.sql
\set ON_ERROR_STOP on
-- drop the database
set role postgres;
\c postgres
drop database biohub;
drop role biohub_api;
\set ON_ERROR_STOP on
create database biohub;
\c biohub

set client_min_messages=warning;

-- TODO: lock down public but allow access to postgis installed there
--REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;

-- set up spatial extensions
\i create_spatial_extensions.psql

-- set up project management schema
create schema if not exists biohub;
GRANT ALL ON SCHEMA biohub TO postgres;
set search_path = biohub, public;

-- setup biohub api schema
create schema if not exists biohub_dapi_v1;

-- setup api user
create user biohub_api password 'flatpass';
alter schema biohub_dapi_v1 owner to biohub_api;

-- Grant rights on biohub_dapi_v1 to biohub_api user
grant all on schema biohub_dapi_v1 to biohub_api;
grant all on schema biohub_dapi_v1 to postgres;
alter DEFAULT PRIVILEGES in SCHEMA biohub_dapi_v1 grant ALL on tables to biohub_api;
alter DEFAULT PRIVILEGES in SCHEMA biohub_dapi_v1 grant ALL on tables to postgres;

-- biohub grants
GRANT USAGE ON SCHEMA biohub TO biohub_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA biohub GRANT ALL ON TABLES TO biohub_api;

alter role biohub_api set search_path to biohub_dapi_v1, biohub, public, topology;

\i biohub.sql
\i populate_user_identity_source.sql
\i api_set_context.sql
\i tr_audit_trigger.sql
\i tr_generated_audit_triggers.sql
\i api_get_context_user_id.sql
\i api_get_context_system_user_role_id.sql
\i api_user_is_administrator.sql
\i tr_journal_trigger.sql
\i tr_generated_journal_triggers.sql
\i api_get_system_constant.sql
\i api_get_system_metadata_constant.sql

-- populate look up tables
\i populate_system_constant.sql
\i populate_system_role.sql
\i populate_system_metadata_constant.sql
\i populate_submission_status_type.sql
\i populate_submission_message_class.sql
\i populate_submission_message_type.sql
\i populate_source.sql

-- create the views
set search_path = biohub_dapi_v1;
set role biohub_api;
\i vw_generated_dapi_views.sql

set role postgres;
set search_path = biohub;
grant execute on function api_set_context(_system_user_identifier system_user.user_identifier%type, _user_identity_source_name user_identity_source.name%type) to biohub_api;
