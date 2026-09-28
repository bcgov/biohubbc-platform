import type { Knex } from 'knex';

/** Link every screening event to its own security review, backfilling historical events before enforcing the invariant. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload_security
      ADD COLUMN submission_upload_review_id uuid
        REFERENCES submission_upload_review(submission_upload_review_id),
      ADD CONSTRAINT submission_upload_security_review_uk UNIQUE (submission_upload_review_id);

    -- Allocate one review per event, including repeated screening attempts for the same upload.
    -- This records historical screening state without re-evaluating rules or changing assignments.
    WITH historical_events AS (
      SELECT submission_upload_security_id, submission_upload_id, status, create_user,
        gen_random_uuid() AS submission_upload_review_id
      FROM submission_upload_security
      WHERE submission_upload_review_id IS NULL
    ), backfill_reviews AS (
      INSERT INTO submission_upload_review
        (submission_upload_review_id, submission_upload_id, scope, status, name, description, requested_by)
      SELECT submission_upload_review_id, submission_upload_id, 'security',
        CASE status
          WHEN 'completed' THEN 'completed'
          WHEN 'failed' THEN 'blocked'
          WHEN 'started' THEN 'in_progress'
          ELSE 'pending'
        END::submission_upload_review_status,
        'Automatic security screening (backfill)',
        'Created from a historical screening event; no rules were evaluated during backfill.',
        create_user
      FROM historical_events
      RETURNING submission_upload_review_id
    )
    UPDATE submission_upload_security event
    SET submission_upload_review_id = review.submission_upload_review_id
    FROM historical_events historical
    JOIN backfill_reviews review USING (submission_upload_review_id)
    WHERE event.submission_upload_security_id = historical.submission_upload_security_id;

    ALTER TABLE submission_upload_security
      ALTER COLUMN submission_upload_review_id SET NOT NULL;

    COMMENT ON COLUMN submission_upload_security.submission_upload_review_id IS
      'Security review for this screening event. Historical events have a dedicated backfill review.';
  `);
}

/** Remove the event link while retaining review history. */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_upload_security DROP COLUMN submission_upload_review_id;
  `);
}
