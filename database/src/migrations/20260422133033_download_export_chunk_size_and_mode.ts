import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_export
      ADD COLUMN chunk_size_bytes BIGINT NOT NULL DEFAULT 524288000,
      ADD COLUMN mode VARCHAR(32) NOT NULL DEFAULT 'per_feature_type';

    ALTER TABLE download_export
      ADD CONSTRAINT download_export_mode_check
        CHECK (mode IN ('per_feature_type', 'denormalized'));

    COMMENT ON COLUMN download_export.chunk_size_bytes IS 'Size threshold in bytes used to split each logical CSV into chunks. Default 500 MB (524288000). Per-export knob — a single download can be re-exported at different chunk sizes. Distinct from download.fragment_size_bytes, which is the Parquet write-pipeline equivalent.';

    COMMENT ON COLUMN download_export.mode IS 'Export shape discriminator. ''per_feature_type'' = one logical CSV per feature type (star). ''denormalized'' = single flat CSV with user-selected columns pre-joined across feature types (future). CHECK constraint bounds the set to prevent typos reaching the pipeline.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_export DROP CONSTRAINT IF EXISTS download_export_mode_check;
    ALTER TABLE download_export DROP COLUMN IF EXISTS mode;
    ALTER TABLE download_export DROP COLUMN IF EXISTS chunk_size_bytes;
  `);
}
