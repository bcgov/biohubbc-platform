import { Knex } from 'knex';

/**
 * Add status + submission_upload_security_id to submission_feature_security.
 *
 * status:
 * 'draft'  — inserted by an automatic screening event; row is under review and must NOT trigger
 *            feature access restrictions until promoted to 'active'.
 * 'active' — record is confirmed and enforces access restrictions. This is the default so that
 *            existing manually-applied rows and the manual-apply path continue to behave as before
 *            without any data migration.
 *
 * submission_upload_security_id:
 * Nullable foreign key to the submission_upload_security (screening event) that produced the row.
 * NULL = manual or legacy security; non-null = produced by a specific scan event. Requires the
 * submission_upload_security table to already exist (created in an earlier migration).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_feature_security_status AS ENUM (
      'draft',
      'active'
    );

    COMMENT ON TYPE submission_feature_security_status IS
      'Status of a submission_feature_security row. draft=inserted by automatic screening, pending admin confirmation; active=confirmed, enforces access restrictions.';

    ALTER TABLE submission_feature_security
      ADD COLUMN status submission_feature_security_status NOT NULL DEFAULT 'active'::submission_feature_security_status;

    COMMENT ON COLUMN submission_feature_security.status IS
      'Status of the security record. draft=inserted by automatic screening, pending admin confirmation; active=confirmed, enforces access restrictions. Defaults to active so existing and manually-applied rows are immediately effective.';

    ALTER TABLE submission_feature_security
      ADD COLUMN submission_upload_security_id INTEGER;

    ALTER TABLE submission_feature_security
      ADD CONSTRAINT submission_feature_security_fk3
        FOREIGN KEY (submission_upload_security_id) REFERENCES submission_upload_security(submission_upload_security_id);

    CREATE INDEX submission_feature_security_idx3 ON submission_feature_security(submission_upload_security_id);

    COMMENT ON COLUMN submission_feature_security.submission_upload_security_id IS
      'Foreign key to the submission_upload_security (screening event) that produced this row. NULL = manual or legacy security; non-null = produced by a specific scan event.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_feature_security_idx3;

    ALTER TABLE submission_feature_security
      DROP CONSTRAINT IF EXISTS submission_feature_security_fk3;

    ALTER TABLE submission_feature_security
      DROP COLUMN IF EXISTS submission_upload_security_id;

    ALTER TABLE submission_feature_security
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS submission_feature_security_status;
  `);
}
