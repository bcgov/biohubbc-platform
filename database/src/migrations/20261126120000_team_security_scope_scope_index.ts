import { Knex } from 'knex';

/**
 * Adds an index on `team_security_scope (security_scope_id)`.
 *
 * The table's only indexes lead on `team_security_scope_id` and `team_id`, so finding whether any team holds a
 * scope scanned the whole table. That lookup runs in the request that gives a team a scope, before the bitmap of
 * a scope no team holds is cleared.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE INDEX team_security_scope_idx1 ON team_security_scope(security_scope_id);
  `);
}

/**
 * Drops the index.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS team_security_scope_idx1;
  `);
}
