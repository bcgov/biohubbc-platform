import type { Knex } from 'knex';

/**
 * Add the `draft` submission upload status, and open an upload's ticket only once it is submitted.
 *
 * A draft upload exists but has not been submitted: its content is still being supplied, so it is not ready for
 * ingestion and has no ticket. `draft` sorts before `uploaded` and is not a processing stage, so processing never
 * starts from it. Submitting the upload opens its ticket and moves it to `uploaded`.
 *
 * `ALTER TYPE ... ADD VALUE` may run inside the migration transaction only while the new value is unused in that
 * transaction, and pending migrations share one transaction. The check constraint therefore compares the status as
 * text rather than as a `draft` enum literal.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'uploaded';

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload processing lifecycle: draft=created but not yet submitted, not ready for ingestion; uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    COMMENT ON COLUMN submission_upload.status IS
      'Authoritative current processing status of the upload. draft=created but not yet submitted, not ready for ingestion; uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload ALTER COLUMN ticket_id DROP NOT NULL;

    ALTER TABLE submission_upload ADD CONSTRAINT submission_upload_ticket_ck
      CHECK (status::text = 'draft' OR ticket_id IS NOT NULL);

    COMMENT ON COLUMN submission_upload.ticket_id IS
      'Foreign key to the ticket associated with this submission upload. Null only while the upload is a draft; submitting the upload opens its ticket.';
  `);
}

/**
 * Remove the `draft` status and require a ticket on every upload again.
 *
 * Draft uploads have no ticket and nothing processed from them, so they are deleted with their history rows.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DELETE FROM submission_upload_status
    WHERE submission_upload_id IN (
      SELECT submission_upload_id FROM submission_upload WHERE status::text = 'draft'
    );

    DELETE FROM submission_upload WHERE status::text = 'draft';

    ALTER TABLE submission_upload DROP CONSTRAINT IF EXISTS submission_upload_ticket_ck;

    ALTER TABLE submission_upload ALTER COLUMN ticket_id SET NOT NULL;

    COMMENT ON COLUMN submission_upload.ticket_id IS 'Foreign key to the ticket associated with this submission upload.';

    CREATE TYPE submission_upload_job_status_v1 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'reconciled',
      'promoted',
      'indexing',
      'indexed',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v1
      USING status::text::submission_upload_job_status_v1;

    ALTER TABLE submission_upload_status
      ALTER COLUMN status TYPE submission_upload_job_status_v1
      USING status::text::submission_upload_job_status_v1;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v1 RENAME TO submission_upload_job_status;

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload processing lifecycle: uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Authoritative current processing status of the upload. uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; reconciled=features reconciled against the prior upload; promoted=reconciled features promoted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';
  `);
}
