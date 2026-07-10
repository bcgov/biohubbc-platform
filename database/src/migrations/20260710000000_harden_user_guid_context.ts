import type { Knex } from 'knex';

/**
 * Harden system_user GUID handling.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    -------------------------------------------------------------------------
    -- 1. Collapse system_user rows whose GUIDs differ only by case.
    -------------------------------------------------------------------------
    CREATE TEMP TABLE _system_user_guid_dedupe_map ON COMMIT DROP AS
    WITH ranked_system_users AS (
      SELECT
        system_user_id,
        first_value(system_user_id) OVER (
          PARTITION BY lower(user_guid)
          ORDER BY (record_end_date IS NULL) DESC, record_end_date NULLS LAST, system_user_id
        ) AS keep_id,
        row_number() OVER (
          PARTITION BY lower(user_guid)
          ORDER BY (record_end_date IS NULL) DESC, record_end_date NULLS LAST, system_user_id
        ) AS row_number
      FROM "system_user"
    )
    SELECT
      system_user_id AS duplicate_id,
      keep_id
    FROM ranked_system_users
    WHERE row_number > 1;

    INSERT INTO system_user_role (system_user_id, system_role_id)
    SELECT DISTINCT
      dedupe.keep_id,
      system_user_role.system_role_id
    FROM system_user_role
    JOIN _system_user_guid_dedupe_map dedupe
      ON dedupe.duplicate_id = system_user_role.system_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM system_user_role existing_role
      WHERE existing_role.system_user_id = dedupe.keep_id
      AND existing_role.system_role_id = system_user_role.system_role_id
    );

    DELETE FROM system_user_role
    USING _system_user_guid_dedupe_map dedupe
    WHERE system_user_role.system_user_id = dedupe.duplicate_id;

    DELETE FROM team_member duplicate_team_member
    USING _system_user_guid_dedupe_map dedupe
    WHERE duplicate_team_member.system_user_id = dedupe.duplicate_id
    AND EXISTS (
      SELECT 1
      FROM team_member keep_team_member
      WHERE keep_team_member.system_user_id = dedupe.keep_id
      AND keep_team_member.team_id = duplicate_team_member.team_id
    );

    DELETE FROM contributor_system_user duplicate_contributor_system_user
    USING _system_user_guid_dedupe_map dedupe
    WHERE duplicate_contributor_system_user.system_user_id = dedupe.duplicate_id
    AND EXISTS (
      SELECT 1
      FROM contributor_system_user keep_contributor_system_user
      WHERE keep_contributor_system_user.system_user_id = dedupe.keep_id
      AND (
        (
          keep_contributor_system_user.record_end_date IS NULL
          AND duplicate_contributor_system_user.record_end_date IS NULL
        )
        OR (
          keep_contributor_system_user.contributor_id = duplicate_contributor_system_user.contributor_id
          AND (keep_contributor_system_user.record_end_date IS NULL) = (duplicate_contributor_system_user.record_end_date IS NULL)
        )
      )
    );

    DELETE FROM ticket_system_user duplicate_ticket_system_user
    USING _system_user_guid_dedupe_map dedupe
    WHERE duplicate_ticket_system_user.system_user_id = dedupe.duplicate_id
    AND EXISTS (
      SELECT 1
      FROM ticket_system_user keep_ticket_system_user
      WHERE keep_ticket_system_user.system_user_id = dedupe.keep_id
      AND keep_ticket_system_user.ticket_id = duplicate_ticket_system_user.ticket_id
      AND (keep_ticket_system_user.record_end_date IS NULL) = (duplicate_ticket_system_user.record_end_date IS NULL)
    );

    DO $$
    DECLARE
      foreign_key record;
    BEGIN
      FOR foreign_key IN
        SELECT
          table_constraint.conrelid::regclass AS table_name,
          column_attribute.attname AS column_name
        FROM pg_constraint table_constraint
        JOIN pg_attribute column_attribute
          ON column_attribute.attrelid = table_constraint.conrelid
          AND column_attribute.attnum = table_constraint.conkey[1]
        WHERE table_constraint.contype = 'f'
        AND table_constraint.confrelid = 'biohub.system_user'::regclass
        AND array_length(table_constraint.conkey, 1) = 1
        AND array_length(table_constraint.confkey, 1) = 1
      LOOP
        EXECUTE format(
          'UPDATE %s referencing_table SET %I = dedupe.keep_id FROM _system_user_guid_dedupe_map dedupe WHERE referencing_table.%I = dedupe.duplicate_id',
          foreign_key.table_name,
          foreign_key.column_name,
          foreign_key.column_name
        );
      END LOOP;
    END $$;

    DELETE FROM "system_user"
    USING _system_user_guid_dedupe_map dedupe
    WHERE "system_user".system_user_id = dedupe.duplicate_id;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM "system_user"
        GROUP BY lower(user_guid)
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Failed to deduplicate system_user GUIDs before creating the case-insensitive unique index.';
      END IF;
    END $$;

    -------------------------------------------------------------------------
    -- 2. Enforce one system_user row per case-insensitive GUID.
    -------------------------------------------------------------------------
    DROP INDEX IF EXISTS system_user_nuk2;

    CREATE UNIQUE INDEX system_user_nuk2 ON "system_user"(LOWER(user_guid));

    -------------------------------------------------------------------------
    -- 3. Resolve API context by case-insensitive GUID and identity source.
    -------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION api_set_context(p_system_user_guid "system_user".user_guid%type, p_user_identity_source_name user_identity_source.name%type) returns "system_user".system_user_id%type
    language plpgsql
    security invoker
    set client_min_messages = warning
    as
    $$
    declare
      _system_user_id "system_user".system_user_id%type;
    begin

      select su.system_user_id into strict _system_user_id
      from "system_user" su
      join user_identity_source uis
        on uis.user_identity_source_id = su.user_identity_source_id
      where uis.name = p_user_identity_source_name
      and uis.record_end_date is null
      and lower(su.user_guid) = lower(p_system_user_guid);

      create temp table if not exists biohub_context_temp (tag varchar(200), value varchar(200));
      delete from biohub_context_temp where tag = 'user_id';
      insert into biohub_context_temp (tag, value) values ('user_id', _system_user_id::varchar(200));

      return _system_user_id;
    end;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    -------------------------------------------------------------------------
    -- Restore the previous API context function shape.
    -------------------------------------------------------------------------
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

    -------------------------------------------------------------------------
    -- Restore the prior case-sensitive GUID index. Deleted duplicate rows
    -- cannot be reconstructed safely, so the data cleanup is irreversible.
    -------------------------------------------------------------------------
    DROP INDEX IF EXISTS system_user_nuk2;

    CREATE UNIQUE INDEX system_user_nuk2 ON "system_user"(user_guid);
  `);
}
