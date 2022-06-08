import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_SCHEMA_DAPI_V1 = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add `survey.surveyed_all_areas` column and update `survey` view.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};

    insert into source_transform (system_user_id, version, metadata_index, transform_filename, transform_key, transform_precompile_filename, transform_precompile_key)
		values ((select system_user_id from system_user where user_identifier = 'SIMS-SVC'), '1.0', 'biohub_metadata', 'sims-svc-stylesheet-v1.xsl',
    'platform/transformations/SIMS-SVC/1/sims-svc-stylesheet-v1.xsl', 'sims-svc-stylesheet-v1-compiled.sef.json',
    'platform/transformations/SIMS-SVC/1/sims-svc-stylesheet-v1-compiled.sef.json');

  `);
}

/**
 * Drop `survey.surveyed_all_areas` column and update `survey` view.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
