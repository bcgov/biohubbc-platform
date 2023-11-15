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
    set search_path=biohub;
    DROP INDEX if exists artifact_persecution_uk1;
    CREATE UNIQUE INDEX artifact_persecution_uk1 ON artifact_persecution(artifact_id, persecution_or_harm_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
