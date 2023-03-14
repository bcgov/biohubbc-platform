import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const API_SCHEMA = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add the column `key` to the `submission_job_queue` table.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${DB_SCHEMA}.submission_job_queue ADD COLUMN key varchar(1000) NOT NULL;
    COMMENT ON COLUMN ${DB_SCHEMA}.submission_job_queue.key IS 'The identifying key to the file in the storage system.';

    CREATE OR REPLACE VIEW ${API_SCHEMA}.submission_job_queue as SELECT * FROM ${DB_SCHEMA}.submission_job_queue;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE submission_job_queue DROP COLUMN key;
  `);
}
