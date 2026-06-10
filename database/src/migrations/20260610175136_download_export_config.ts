import type { Knex } from 'knex';

/**
 * Replaces the format/mode/exporter_version dedupe key on download_version_export_artifact_group
 * with a single normalized export recipe (config) and its content hash (config_hash).
 *
 * The recipe is a self-contained description of how to read, join, and write an export. Hashing
 * it canonically lets identical recipes against one version dedupe onto a single artifact group,
 * and folds the old format/mode/exporter_version cache key into the hash itself.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    ALTER TABLE download_version_export_artifact_group
      ADD COLUMN config JSONB NOT NULL,
      ADD COLUMN config_hash VARCHAR(64) NOT NULL;

    DROP INDEX download_version_export_artifact_group_nuk1;

    CREATE UNIQUE INDEX download_version_export_artifact_group_nuk1
      ON download_version_export_artifact_group (download_version_id, config_hash, max_part_size_bytes, exporter_version)
      WHERE record_end_date IS NULL;

    COMMENT ON COLUMN download_version_export_artifact_group.config IS 'The normalized, self-contained export recipe (version, export_type, mode, root_feature_type, feature_types, merge_steps, output_columns). Read whole at job time to drive read→join→write.';
    COMMENT ON COLUMN download_version_export_artifact_group.config_hash IS 'SHA-256 hex of the canonical recipe, computed app-side at write time. Identifies the recipe for artifact reuse — identical recipes against one version dedupe onto one group.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP INDEX download_version_export_artifact_group_nuk1;

    CREATE UNIQUE INDEX download_version_export_artifact_group_nuk1
      ON download_version_export_artifact_group (download_version_id, format, mode, max_part_size_bytes, exporter_version)
      WHERE record_end_date IS NULL;

    ALTER TABLE download_version_export_artifact_group
      DROP COLUMN config_hash,
      DROP COLUMN config;
  `);
}
