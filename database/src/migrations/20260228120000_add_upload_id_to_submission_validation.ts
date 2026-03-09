import { Knex } from 'knex';

/**
 * Add submission_upload_id column to submission_validation so each validation record
 * can be traced back to the specific upload event that triggered it.
 * Uses submission_upload as the FK target (not upload) because submission_upload_id
 * is the processing identifier — it tracks which upload event for a given submission.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_validation
      ADD COLUMN submission_upload_id uuid;

    ALTER TABLE submission_validation
      ADD CONSTRAINT submission_validation_fk2
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id);

    CREATE INDEX submission_validation_idx4
      ON submission_validation(submission_upload_id);

    COMMENT ON COLUMN submission_validation.submission_upload_id IS 'Foreign key to the submission_upload table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_validation
      DROP CONSTRAINT IF EXISTS submission_validation_fk2;

    ALTER TABLE submission_validation
      DROP COLUMN IF EXISTS submission_upload_id;
  `);
}
