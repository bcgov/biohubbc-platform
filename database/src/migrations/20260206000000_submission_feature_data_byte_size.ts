import { Knex } from 'knex';

/**
 * Add pre-computed data_byte_size column to submission_feature.
 *
 * Enables fast SUM() aggregation for download size estimation at scale (1M+ rows)
 * without casting JSONB to text on every query.
 *
 * Size = octet_length(data::text) + 500 (CSV overhead) + artifact file size (if applicable).
 * Computed inline by insertSubmissionFeatureRecord; no trigger needed.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_feature ADD COLUMN data_byte_size BIGINT;

    -- Backfill existing rows (includes artifact file size for file features)
    UPDATE submission_feature sf
    SET data_byte_size = octet_length(sf.data::text) + 500 + COALESCE(
      (SELECT a.byte_size FROM artifact a WHERE a.object_key = sf.data->>'artifact_key'),
      0
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE submission_feature DROP COLUMN IF EXISTS data_byte_size;
  `);
}
