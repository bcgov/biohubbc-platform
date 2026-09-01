import { Knex } from 'knex';
import { escapeLiteral } from '../utils/migrations';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';

/**
 * Apply the martin role's base grants on every deploy.
 *
 * Role CREATION stays in the one-shot migration (20260723120000_create_martin_db_user.ts) — and in
 * Crunchy environments in the operator — but a one-shot migration cannot repair ordering mistakes:
 * if it ran while the role did not exist yet (crunchy-db upgraded after the platform), it skipped
 * these grants with a warning and will never run again. Re-applying them here, on every deploy,
 * makes that state self-healing: as soon as the role exists, the next deploy grants it schema
 * access. Everything below is idempotent.
 *
 * Function EXECUTE grants are deliberately not here: each tile function seed owns its own grants,
 * so a function and its access control always land together.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    DO $grants$
    DECLARE
      v_martin_role text := '${escapeLiteral(DB_USER_MARTIN)}';
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_martin_role) THEN
        --------------------------------------------------------------------------------------
        -- Least privilege grants. NOTE: no table grants and no ALTER DEFAULT PRIVILEGES, by
        -- design. Mirrors the one-shot migration; see the header for why both exist.
        --------------------------------------------------------------------------------------
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), v_martin_role);
        EXECUTE format('GRANT USAGE ON SCHEMA biohub TO %I', v_martin_role);

        -- Tile functions are unqualified in the Martin config, and PostGIS lives in public.
        EXECUTE format('ALTER ROLE %I SET search_path TO biohub, public', v_martin_role);

        -- Bound the damage a pathological tile request can do to the database.
        EXECUTE format('ALTER ROLE %I SET statement_timeout TO %L', v_martin_role, '30s');
      ELSE
        RAISE WARNING 'Role % does not exist; skipping martin role grants (re-applied on the next deploy once it does).', v_martin_role;
      END IF;
    END
    $grants$;
  `);
}
