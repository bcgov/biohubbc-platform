import { Knex } from 'knex';

/**
 * Add missing indexes on submission_feature_id for download join tables.
 *
 * These FK columns are used in joins during download planning and fragment
 * processing but were not indexed, causing sequential scans.
 *
 * See: SIMSBIOHUB-823
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE INDEX download_feature_idx2 ON download_feature(submission_feature_id);
    CREATE INDEX download_fragment_feature_idx2 ON download_fragment_feature(submission_feature_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS download_feature_idx2;
    DROP INDEX IF EXISTS download_fragment_feature_idx2;
  `);
}
