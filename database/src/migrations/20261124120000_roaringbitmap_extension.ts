import type { Knex } from 'knex';

/**
 * Install the `roaringbitmap` extension (pg_roaringbitmap), which adds the `roaringbitmap` type and its
 * set operations (`rb_build`, `rb_and`, `rb_or_agg`, ...).
 *
 * The extension's library is not part of the stock Crunchy image: DEV/TEST/PROD run the image built from
 * `infrastructure/crunchy-db/image`, and local and PR-preview databases build it in `database/Dockerfile`
 * and `database/.docker/db/Dockerfile`. Installing an untrusted extension needs a superuser, which the
 * migration user (`postgres`) is.
 *
 * The extension lives in `public` beside PostGIS. Its functions keep PostgreSQL's default EXECUTE grant to
 * PUBLIC, so `biohub_api` and `martin` can call them without further grants.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    CREATE EXTENSION IF NOT EXISTS roaringbitmap SCHEMA public;
  `);
}

/**
 * Remove the `roaringbitmap` extension.
 *
 * Refuses (rather than cascading) while any column, function or view still depends on its types.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    DROP EXTENSION IF EXISTS roaringbitmap;
  `);
}
