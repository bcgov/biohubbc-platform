import type { Knex } from 'knex';

/**
 * Support asynchronous upload approval.
 *
 * Adds the `approving` review decision. Approving an upload records `approving` and queues a job that
 * activates the upload's features and then records `approved`, so a large activation no longer runs
 * inside the HTTP request.
 *
 * `ALTER TYPE ... ADD VALUE` may run inside the migration transaction because the new value is not used
 * until after it commits.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TYPE submission_upload_decision ADD VALUE IF NOT EXISTS 'approving' BEFORE 'approved';

    COMMENT ON TYPE submission_upload_decision IS
      'Human review decision on a submission upload: pending=awaiting review; approving=approved by an administrator, feature activation queued; approved=accepted by an administrator and features activated; denied=rejected by an administrator.';
  `);
}

/**
 * Remove the `approving` decision.
 *
 * Uploads still `approving` return to `pending`: their features were never activated.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE submission_upload_decision_v1 AS ENUM ('pending', 'approved', 'denied');

    ALTER TABLE submission_upload
      ALTER COLUMN decision DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN decision TYPE submission_upload_decision_v1
      USING (
        CASE decision::text
          WHEN 'approving' THEN 'pending'
          ELSE decision::text
        END
      )::submission_upload_decision_v1;

    DROP TYPE submission_upload_decision;

    ALTER TYPE submission_upload_decision_v1 RENAME TO submission_upload_decision;

    COMMENT ON TYPE submission_upload_decision IS
      'Human review decision on a submission upload: pending=awaiting review; approved=accepted by an administrator; denied=rejected by an administrator.';

    ALTER TABLE submission_upload
      ALTER COLUMN decision SET DEFAULT 'pending'::submission_upload_decision;
  `);
}
