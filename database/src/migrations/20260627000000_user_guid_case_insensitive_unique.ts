import { Knex } from 'knex';

/**
 * Make `system_user.user_guid` resolution case-insensitive everywhere:
 *
 * 1. Replace the case-sensitive unique index on `user_guid` with a case-insensitive one on `LOWER(user_guid)`, so one
 *    record per Keycloak GUID is enforced regardless of casing. A revoked (soft-deleted) user logging in again with a
 *    differently-cased GUID then resolves to the existing row rather than being recreated as a new active user.
 *    If any pre-existing rows differ only by GUID casing, the index creation would fail; a guard raises a clear error
 *    first so the collision can be remediated before this migration is re-run.
 *
 * 2. Update `api_set_context` to resolve the session's `system_user` by `LOWER(user_guid)`. The API stores GUIDs
 *    lower-cased and looks them up case-insensitively, but `api_set_context` receives the raw token GUID; without this
 *    change a non-lower-case token GUID would fail to resolve the (lower-cased) `system_user` row and break the
 *    request's database context.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    DO $$
    DECLARE
      duplicate_count integer;
    BEGIN
      SELECT count(*) INTO duplicate_count FROM (
        SELECT LOWER(user_guid)
        FROM "system_user"
        GROUP BY LOWER(user_guid)
        HAVING count(*) > 1
      ) duplicates;

      IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Cannot create case-insensitive unique index: % system_user GUID(s) collide when lower-cased. Deduplicate before re-running.', duplicate_count;
      END IF;
    END $$;

    DROP INDEX IF EXISTS system_user_nuk2;

    CREATE UNIQUE INDEX system_user_nuk2 ON "system_user"(LOWER(user_guid));

    CREATE OR REPLACE FUNCTION api_set_context(p_system_user_guid "system_user".user_guid%type, p_user_identity_source_name user_identity_source.name%type) returns "system_user".system_user_id%type
    language plpgsql
    security invoker
    set client_min_messages = warning
    as
    $$
    declare
      _system_user_id "system_user".system_user_id%type;
      _user_identity_source_id user_identity_source.user_identity_source_id%type;
    begin

      select user_identity_source_id into strict _user_identity_source_id from user_identity_source
        where name = p_user_identity_source_name
        and record_end_date is null;

      select system_user_id into strict _system_user_id from "system_user"
        where user_identity_source_id = _user_identity_source_id
        and LOWER(user_guid) = LOWER(p_system_user_guid);

      create temp table if not exists biohub_context_temp (tag varchar(200), value varchar(200));
      delete from biohub_context_temp where tag = 'user_id';
      insert into biohub_context_temp (tag, value) values ('user_id', _system_user_id::varchar(200));

      return _system_user_id;
    exception
      when others THEN
        raise;
    end;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET search_path=biohub,public;

    CREATE OR REPLACE FUNCTION api_set_context(p_system_user_guid "system_user".user_guid%type, p_user_identity_source_name user_identity_source.name%type) returns "system_user".system_user_id%type
    language plpgsql
    security invoker
    set client_min_messages = warning
    as
    $$
    declare
      _system_user_id "system_user".system_user_id%type;
      _user_identity_source_id user_identity_source.user_identity_source_id%type;
    begin

      select user_identity_source_id into strict _user_identity_source_id from user_identity_source
        where name = p_user_identity_source_name
        and record_end_date is null;

      select system_user_id into strict _system_user_id from "system_user"
        where user_identity_source_id = _user_identity_source_id
        and user_guid = p_system_user_guid;

      create temp table if not exists biohub_context_temp (tag varchar(200), value varchar(200));
      delete from biohub_context_temp where tag = 'user_id';
      insert into biohub_context_temp (tag, value) values ('user_id', _system_user_id::varchar(200));

      return _system_user_id;
    exception
      when others THEN
        raise;
    end;
    $$;

    DROP INDEX IF EXISTS system_user_nuk2;

    CREATE UNIQUE INDEX system_user_nuk2 ON "system_user"(user_guid);
  `);
}
