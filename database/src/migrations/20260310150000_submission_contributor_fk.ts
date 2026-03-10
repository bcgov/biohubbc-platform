import { Knex } from 'knex';

/**
 * Replace submission.source_system with submission.contributor_id FK.
 *
 * Backfill strategy:
 * 1) Map by submission.system_user_id -> contributor_system_user.contributor_id.
 * 2) For remaining rows, create/find contributors using legacy source_system values and map by client_id.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission
      ADD COLUMN contributor_id integer;

    -- Pass 1: map submissions by system_user -> contributor_system_user
    WITH active_contributor_map AS (
      SELECT system_user_id, MIN(contributor_id) AS contributor_id
      FROM contributor_system_user
      WHERE record_end_date IS NULL
      GROUP BY system_user_id
    )
    UPDATE submission s
    SET contributor_id = map.contributor_id
    FROM active_contributor_map map
    WHERE s.system_user_id = map.system_user_id
      AND s.contributor_id IS NULL;

    -- Pass 2a: ensure contributors exist for remaining legacy source_system values
    INSERT INTO contributor (client_id, description)
    SELECT DISTINCT
      s.source_system AS client_id,
      'Backfilled from submission.source_system'
    FROM submission s
    LEFT JOIN contributor c
      ON c.client_id = s.source_system
      AND c.record_end_date IS NULL
    WHERE s.contributor_id IS NULL
      AND s.source_system IS NOT NULL
      AND c.contributor_id IS NULL;

    -- Pass 2b: map remaining submissions by legacy source_system -> contributor.client_id
    UPDATE submission s
    SET contributor_id = c.contributor_id
    FROM contributor c
    WHERE s.contributor_id IS NULL
      AND s.source_system = c.client_id
      AND c.record_end_date IS NULL;

    -- Assert full backfill before enforcing NOT NULL
    DO $$
    DECLARE
      unmapped_count integer;
    BEGIN
      SELECT COUNT(*)
      INTO unmapped_count
      FROM submission
      WHERE contributor_id IS NULL;

      IF unmapped_count > 0 THEN
        RAISE EXCEPTION 'Failed to backfill submission.contributor_id. % rows remain NULL.', unmapped_count;
      END IF;
    END $$;

    ALTER TABLE submission
      ALTER COLUMN contributor_id SET NOT NULL;

    ALTER TABLE submission
      ADD CONSTRAINT submission_fk2
      FOREIGN KEY (contributor_id)
      REFERENCES contributor(contributor_id);

    CREATE INDEX submission_idx2 ON submission(contributor_id);

    COMMENT ON COLUMN submission.contributor_id IS 'Foreign key to the contributor table.';

    ALTER TABLE submission
      DROP COLUMN source_system;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission
      ADD COLUMN source_system varchar(100);

    UPDATE submission s
    SET source_system = c.client_id
    FROM contributor c
    WHERE s.contributor_id = c.contributor_id;

    UPDATE submission
    SET source_system = 'unknown-contributor'
    WHERE source_system IS NULL;

    ALTER TABLE submission
      ALTER COLUMN source_system SET NOT NULL;

    COMMENT ON COLUMN submission.source_system IS 'The name of the submitting system.';

    DROP INDEX IF EXISTS submission_idx2;

    ALTER TABLE submission
      DROP CONSTRAINT IF EXISTS submission_fk2;

    ALTER TABLE submission
      DROP COLUMN contributor_id;
  `);
}
