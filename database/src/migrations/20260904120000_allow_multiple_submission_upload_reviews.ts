import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Add review details
    ----------------------------------------------------------------------------------------

    ALTER TABLE submission_upload_review
      ADD COLUMN name varchar(100) NOT NULL DEFAULT 'Review',
      ADD COLUMN description varchar(500);

    COMMENT ON COLUMN submission_upload_review.name IS 'Human-readable name for this review context.';
    COMMENT ON COLUMN submission_upload_review.description IS 'Optional description of the review context.';

    ----------------------------------------------------------------------------------------
    -- Allow multiple active reviews per upload and scope
    ----------------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_upload_review_nuk1;

    CREATE INDEX submission_upload_review_idx1
      ON submission_upload_review(
        submission_upload_id,
        scope,
        create_date DESC,
        submission_upload_review_id DESC
      )
      WHERE record_end_date IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- Restore one active review per upload and scope
    ----------------------------------------------------------------------------------------

    DROP INDEX IF EXISTS submission_upload_review_idx1;

    CREATE UNIQUE INDEX submission_upload_review_nuk1
      ON submission_upload_review(submission_upload_id, scope)
      WHERE record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- Remove review details
    ----------------------------------------------------------------------------------------

    ALTER TABLE submission_upload_review
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS name;
  `);
}
