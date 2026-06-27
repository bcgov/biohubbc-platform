import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS policy_nuk1;

    COMMENT ON COLUMN policy.name IS 'Human-readable policy name. Not unique; download policies may share display names.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM policy
        WHERE record_end_date IS NULL
        GROUP BY name
        HAVING count(*) > 1
      ) THEN
        UPDATE policy
        SET name = left(name, 61) || ' [' || policy_id::text || ']'
        WHERE record_end_date IS NULL;
      END IF;
    END $$;

    CREATE UNIQUE INDEX policy_nuk1
      ON policy(name, (record_end_date is NULL))
      WHERE record_end_date IS NULL;

    COMMENT ON COLUMN policy.name IS 'Unique name for the policy.';
  `);
}
