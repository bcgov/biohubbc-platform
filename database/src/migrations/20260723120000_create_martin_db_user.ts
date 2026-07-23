import { Knex } from 'knex';

const DB_USER_MARTIN = process.env.DB_USER_MARTIN || 'martin';
const DB_USER_MARTIN_PASS = process.env.DB_USER_MARTIN_PASS;

/**
 * Escape a value for embedding as a SQL string literal inside the dollar-quoted DO block below.
 *
 * @param {string} value
 * @return {*}  {string}
 */
const escapeLiteral = (value: string): string => value.replace(/'/g, `''`);

/**
 * Create the dedicated, least-privilege database role used by the Martin vector tile server.
 *
 * Martin connects directly to PostGIS to render tiles. It is granted the bare minimum required to do
 * so: CONNECT on the database and USAGE on the `biohub` schema. It is deliberately granted NO table
 * privileges and NO default privileges (contrast the `biohub_api` role, which is granted broad
 * table/sequence/function access in `20220225205948_release_0.8.0.ts`). Martin can therefore only read
 * data through tile functions it is explicitly granted EXECUTE on.
 *
 * Role creation is environment dependent:
 * - OpenShift (Crunchy): the Postgres Operator creates the role from the `users` block of the
 *   PostgresCluster CR and owns its password. This migration must not create it or alter its password,
 *   so it only applies the grants.
 * - Local/PR (plain Postgres): no operator exists, so the role is created here using
 *   `DB_USER_MARTIN_PASS`.
 *
 * If the role is missing AND no password is configured, the migration fails loudly rather than
 * silently skipping, because that combination means the Crunchy chart has not been upgraded yet and
 * Martin would be unable to connect.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DO $migration$
    DECLARE
      v_role_name text := '${escapeLiteral(DB_USER_MARTIN)}';
      v_role_pass text := ${DB_USER_MARTIN_PASS ? `'${escapeLiteral(DB_USER_MARTIN_PASS)}'` : 'NULL'};
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role_name) THEN
        -- The role already exists (Crunchy operator managed). Never alter an operator owned password.
        RAISE NOTICE 'Role % already exists, applying grants only.', v_role_name;
      ELSIF v_role_pass IS NULL OR v_role_pass = '' THEN
        RAISE EXCEPTION
          'Database role % does not exist and no DB_USER_MARTIN_PASS was provided. In Crunchy environments the role is created by the Postgres Operator - upgrade the infrastructure/crunchy-db chart before deploying Martin.',
          v_role_name;
      ELSE
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', v_role_name, v_role_pass);
      END IF;

      ----------------------------------------------------------------------------------------
      -- Least privilege grants. Idempotent, and re-applied on every deploy.
      -- NOTE: no table grants and no ALTER DEFAULT PRIVILEGES, by design.
      ----------------------------------------------------------------------------------------
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), v_role_name);
      EXECUTE format('GRANT USAGE ON SCHEMA biohub TO %I', v_role_name);

      -- Tile functions are unqualified in the Martin config, and PostGIS lives in public.
      EXECUTE format('ALTER ROLE %I SET search_path TO biohub, public', v_role_name);

      -- Bound the damage a pathological tile request can do to the database.
      EXECUTE format('ALTER ROLE %I SET statement_timeout TO %L', v_role_name, '30s');
    END
    $migration$;
  `);
}

/**
 * Drop the Martin database role.
 *
 * In Crunchy environments the Postgres Operator will recreate the role on its next reconcile, since it
 * is declared in the PostgresCluster CR.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DO $migration$
    DECLARE
      v_role_name text := '${escapeLiteral(DB_USER_MARTIN)}';
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role_name) THEN
        EXECUTE format('REVOKE ALL ON SCHEMA biohub FROM %I', v_role_name);
        EXECUTE format('DROP OWNED BY %I', v_role_name);
        EXECUTE format('DROP ROLE %I', v_role_name);
      END IF;
    END
    $migration$;
  `);
}
