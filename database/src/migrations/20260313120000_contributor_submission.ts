import { Knex } from 'knex';

/**
 * Replace submission.source_system with submission.contributor_id, and enforce
 * one active contributor_system_user row per system_user_id.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SUBMISSION CONTRIBUTOR ATTRIBUTION
    --------------------------------------------------------------------------------

    ALTER TABLE submission
      ADD COLUMN contributor_id integer;

    -- Ensure a single active backfill contributor exists
    INSERT INTO contributor (client_id, description)
    SELECT
      'backfill',
      'Backfill contributor for legacy submissions'
    WHERE NOT EXISTS (
      SELECT 1
      FROM contributor
      WHERE client_id = 'backfill'
        AND record_end_date IS NULL
    );

    -- Ensure backfill contributor is associated with a DATABASE system user
    WITH database_system_user AS (
      SELECT MIN(su.system_user_id) AS system_user_id
      FROM "system_user" su
      INNER JOIN user_identity_source uis
        ON su.user_identity_source_id = uis.user_identity_source_id
      WHERE uis.name = 'DATABASE'
        AND su.record_end_date IS NULL
        AND uis.record_end_date IS NULL
    )
    INSERT INTO contributor_system_user (contributor_id, system_user_id)
    SELECT
      c.contributor_id,
      dsu.system_user_id
    FROM contributor c
    CROSS JOIN database_system_user dsu
    WHERE c.client_id = 'backfill'
      AND c.record_end_date IS NULL
      AND dsu.system_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM contributor_system_user csu
        WHERE csu.contributor_id = c.contributor_id
          AND csu.system_user_id = dsu.system_user_id
          AND csu.record_end_date IS NULL
      );

    -- Use backfill contributor for all existing submissions
    UPDATE submission s
    SET contributor_id = c.contributor_id
    FROM contributor c
    WHERE c.client_id = 'backfill'
      AND c.record_end_date IS NULL;

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

    --------------------------------------------------------------------------------
    -- CONTRIBUTOR_SYSTEM_USER UNIQUENESS
    --------------------------------------------------------------------------------

    CREATE UNIQUE INDEX contributor_system_uk2
      ON contributor_system_user (system_user_id)
      WHERE record_end_date IS NULL;
  `);
}

/**
 * Revert submission contributor attribution and contributor_system_user uniqueness.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS contributor_system_uk2;

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
