import { Knex } from 'knex';

/**
 * Add upload_id column to submission_feature so each feature can be traced
 * back to the upload session that produced it.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE "submission_feature" ADD COLUMN upload_id uuid NOT NULL;

    CREATE INDEX submission_feature_idx4
      ON submission_feature(upload_id);

    ALTER TABLE "submission_feature" ADD CONSTRAINT submission_feature_fk4
      FOREIGN KEY (upload_id)
      REFERENCES upload (upload_id);

    COMMENT ON COLUMN submission_feature.upload_id IS 'Foreign key to the upload session.';
  `);
}


export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE "submission_feature" 
      DROP CONSTRAINT IF EXISTS submission_feature_fk4;

    ALTER TABLE "submission_feature"
      DROP COLUMN IF EXISTS upload_id;
  `);
}

