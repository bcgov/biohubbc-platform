import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const API_SCHEMA = process.env.DB_SCHEMA_DAPI_V1;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE ${DB_SCHEMA}.submission ADD COLUMN key varchar(1000) NOT NULL;
    COMMENT ON COLUMN ${DB_SCHEMA}.submission.key IS 'The identifying key to the file in the storage system.';

    CREATE OR REPLACE VIEW ${API_SCHEMA}.submission as SELECT * FROM ${DB_SCHEMA}.submission;
    `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE submission DROP COLUMN key;
  `);
}
