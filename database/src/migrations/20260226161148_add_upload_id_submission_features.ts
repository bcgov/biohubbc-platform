import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
    SET search_path=biohub,public;

    ALTER TABLE "submission_feature" ADD COLUMN upload_id uuid NOT NULL;

    CREATE INDEX submission_feature_upload_idx
      ON submission_feature(upload_id);

    -- Add foreign key constraint
    ALTER TABLE "submission_feature" ADD CONSTRAINT upload_id_fk
      FOREIGN KEY (upload_id)
      REFERENCES upload (upload_id);

    COMMENT ON COLUMN submission_feature.upload_id IS 'Foreign key to the upload session.';
  `);
}


export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE "submission_feature" 
      DROP CONSTRAINT IF EXISTS upload_id_fk;

    ALTER TABLE "submission_feature"
      DROP COLUMN IF EXISTS upload_id;
  `);
}

