import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload
      ADD COLUMN comment text;

    COMMENT ON COLUMN submission_upload.comment IS 'Admin-facing comment associated with this specific submission upload.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS comment;
  `);
}
