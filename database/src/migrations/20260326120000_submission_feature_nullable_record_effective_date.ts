import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Allow record_effective_date to be NULL on submission_feature.
    -- NULL indicates the feature has not yet been approved for inclusion
    -- in search results or security scope anchor computation.
    -- Approval workflows set record_effective_date = now(); denial sets it to NULL.
    ALTER TABLE submission_feature
      ALTER COLUMN record_effective_date DROP NOT NULL,
      ALTER COLUMN record_effective_date DROP DEFAULT;

    COMMENT ON COLUMN submission_feature.record_effective_date
      IS 'Date the feature becomes active. NULL indicates the feature is not yet approved. Set by approval workflows; anchor computation and search exclude features where this is NULL or in the future.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Backfill any NULLs before restoring the constraint
    UPDATE submission_feature
    SET record_effective_date = create_date
    WHERE record_effective_date IS NULL;

    ALTER TABLE submission_feature
      ALTER COLUMN record_effective_date SET NOT NULL,
      ALTER COLUMN record_effective_date SET DEFAULT now();
  `);
}
