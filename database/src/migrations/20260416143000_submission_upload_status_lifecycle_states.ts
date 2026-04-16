import { Knex } from 'knex';

/**
 * Add explicit lifecycle states for submission_upload.status.
 *
 * Phase 1 keeps legacy values for dual-read compatibility and only adds new values.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'uploaded';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'ingesting';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'ingested';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'indexing';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'indexed';
  `);
}

export async function down(): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in down migrations without type rebuild.
}
