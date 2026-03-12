import { Knex } from 'knex';

/**
 * Add `codeset` as a valid upload_artifact role so extracted codeset JSON artifacts
 * can be tracked independently from feature and attachment artifacts.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TYPE upload_artifact_role ADD VALUE IF NOT EXISTS 'codeset';
  `);
}

/**
 * Remove `codeset` from upload_artifact_role.
 *
 * Note: PostgreSQL does not support DROP VALUE directly, so we recreate the enum.
 * This down migration will fail if any upload_artifact row still uses role='codeset'.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM upload_artifact WHERE role::text = 'codeset') THEN
        RAISE EXCEPTION 'Cannot downgrade: upload_artifact contains role = codeset rows';
      END IF;
    END$$;

    ALTER TYPE upload_artifact_role RENAME TO upload_artifact_role_old;

    CREATE TYPE upload_artifact_role AS ENUM (
      'feature',
      'attachment'
    );

    ALTER TABLE upload_artifact
      ALTER COLUMN role TYPE upload_artifact_role
      USING role::text::upload_artifact_role;

    DROP TYPE upload_artifact_role_old;
  `);
}
