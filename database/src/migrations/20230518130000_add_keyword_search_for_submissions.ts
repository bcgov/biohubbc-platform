import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const API_SCHEMA = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add some metadata columns to submission metadata to help facilitate more a advance search
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${DB_SCHEMA}.submission_metadata ADD COLUMN dataset_search_criteria jsonb;
    COMMENT ON COLUMN ${DB_SCHEMA}.submission_metadata.dataset_search_criteria IS 'Describes the object the system sends to elastic search';

    ALTER TABLE ${DB_SCHEMA}.submission_metadata ADD COLUMN submitter_system varchar(250);
    COMMENT ON COLUMN ${DB_SCHEMA}.submission_metadata.submitter_system IS 'Describes where the dataset was originated from';

    CREATE OR REPLACE VIEW ${API_SCHEMA}.submission_metadata as SELECT * FROM ${DB_SCHEMA}.submission_metadata;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE submission_job_queue DROP COLUMN key;
  `);
}
