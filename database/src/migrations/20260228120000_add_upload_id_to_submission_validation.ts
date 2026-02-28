import { Knex } from 'knex';

/**
 * Add upload_id column to submission_validation so each validation record
 * can be traced back to the specific upload that triggered it.
 * Enables per-upload job tracking when multiple uploads exist per submission.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_validation
      ADD COLUMN upload_id uuid;

    ALTER TABLE submission_validation
      ADD CONSTRAINT submission_validation_fk1
        FOREIGN KEY (upload_id) REFERENCES upload(upload_id);

    CREATE INDEX submission_validation_idx4
      ON submission_validation(upload_id);

    COMMENT ON COLUMN submission_validation.upload_id IS 'Foreign key to the upload table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_validation
      DROP CONSTRAINT IF EXISTS submission_validation_fk1;

    ALTER TABLE submission_validation
      DROP COLUMN IF EXISTS upload_id;
  `);
}
