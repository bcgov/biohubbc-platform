import { Knex } from 'knex';

/**
 * Add status column to submission_feature_security.
 *
 * 'draft'    — inserted by automatic screening; row is under review and must NOT trigger
 *              feature access restrictions until promoted to 'screened'.
 * 'screened' — record has been confirmed and enforces access restrictions. This is the
 *              default so that existing manually-applied rows and the manual-apply path
 *              continue to behave as before without any data migration.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_feature_security_status AS ENUM (
      'draft',
      'screened'
    );

    COMMENT ON TYPE submission_feature_security_status IS
      'Status of a submission_feature_security row. draft=inserted by automatic screening, pending admin confirmation; screened=confirmed, enforces access restrictions.';

    ALTER TABLE submission_feature_security
      ADD COLUMN status submission_feature_security_status NOT NULL DEFAULT 'screened'::submission_feature_security_status;

    COMMENT ON COLUMN submission_feature_security.status IS
      'Status of the security record. draft=inserted by automatic screening, pending admin confirmation; screened=confirmed, enforces access restrictions. Defaults to screened so existing and manually-applied rows are immediately effective.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_feature_security
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS submission_feature_security_status;
  `);
}
