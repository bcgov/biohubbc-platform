import { Knex } from 'knex';

/**
 * Add human-review provenance and use effective dates for all security assignments, including former drafts.
 * Add indexes for review provenance and current upload feature searches.
 * Existing screening provenance remains unchanged.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_feature_security
      ADD COLUMN submission_upload_review_id uuid REFERENCES submission_upload_review(submission_upload_review_id);

    CREATE INDEX submission_feature_security_idx4 ON submission_feature_security(submission_upload_review_id);

    COMMENT ON INDEX submission_feature_security_idx4 IS
      'Security assignment provenance by submission upload review.';

    CREATE INDEX submission_feature_idx9
      ON submission_feature (submission_upload_id, submission_feature_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx9 IS
      'Current upload feature selection and feature-ID cursor ordering for security review.';

    COMMENT ON COLUMN submission_feature_security.submission_upload_review_id IS
      'Human review that created or materially changed this assignment; provenance only, not visibility or effectiveness.';

    ALTER TABLE submission_feature_security DROP COLUMN status;
    DROP TYPE submission_feature_security_status;
  `);
}

/** Restore the status field with active assignments; previous draft classifications cannot be recovered. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_feature_security_status AS ENUM ('draft', 'active');

    COMMENT ON TYPE submission_feature_security_status IS
      'Status of a submission_feature_security row. draft=inserted by automatic screening, pending admin confirmation; active=confirmed, enforces access restrictions.';

    ALTER TABLE submission_feature_security
      ADD COLUMN status submission_feature_security_status NOT NULL DEFAULT 'active'::submission_feature_security_status;

    COMMENT ON COLUMN submission_feature_security.status IS
      'Status of the security record. draft=inserted by automatic screening, pending admin confirmation; active=confirmed, enforces access restrictions. Defaults to active so existing and manually-applied rows are immediately effective.';

    DROP INDEX submission_feature_idx9;
    DROP INDEX submission_feature_security_idx4;
    ALTER TABLE submission_feature_security DROP COLUMN submission_upload_review_id;
  `);
}
