import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const API_SCHEMA = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add the column `attempt_count` to the `submission_job_queue` table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${DB_SCHEMA}.submission_job_queue ADD COLUMN attempt_count integer DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN ${DB_SCHEMA}.submission_job_queue.attempt_count IS 'The number of times this job queue record has been attempted.';

    CREATE OR REPLACE VIEW ${API_SCHEMA}.submission_job_queue as SELECT * FROM ${DB_SCHEMA}.submission_job_queue;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE submission_job_queue DROP COLUMN attempt_count;

    CREATE OR REPLACE VIEW ${API_SCHEMA}.submission_job_queue as SELECT * FROM ${DB_SCHEMA}.submission_job_queue;
  `);
}
