import { Knex } from 'knex';

/**
 * Remove unique id from artifact_persecution table
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub_dapi_v1;

    drop view if exists artifact_persecution;

    set search_path=biohub;
    DROP INDEX if exists artifact_persecution_uk1;
    CREATE INDEX artifact_persecution_uk1 ON artifact_persecution(persecution_or_harm_id);

    set search_path=biohub_dapi_v1;
    CREATE OR REPLACE VIEW artifact_persecution as SELECT * FROM biohub.artifact_persecution;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
