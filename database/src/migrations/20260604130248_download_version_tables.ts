import type { Knex } from 'knex';

/**
 * Replaces the version-less download_artifact / download_export / download_export_artifact tables
 * with a version-aware model.
 *
 * A download_version is the temporal axis: re-running the same invariant policy at a later point
 * re-snapshots the download to pick up newly uploaded features. The policy itself is never recorded
 * per version — only the materialized artifacts are. Exports hang off a version, and identical
 * export requests share a single materialized artifact group (the active-group dedupe key) so a
 * second user requesting the same shape attaches to an already-ready group instead of rebuilding it.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP LEGACY VERSION-LESS TABLES (reverse dependency order)
    --------------------------------------------------------------------------------

    -- Triggers drop automatically with their tables.
    DROP TABLE IF EXISTS download_export_artifact;
    DROP TABLE IF EXISTS download_export;
    DROP TABLE IF EXISTS download_artifact;

    --------------------------------------------------------------------------------
    -- DOWNLOAD_VERSION
    --------------------------------------------------------------------------------

    CREATE TABLE download_version (
      download_version_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_id UUID NOT NULL,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_version_pk PRIMARY KEY (download_version_id),
      CONSTRAINT download_version_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id)
    );

    CREATE INDEX download_version_idx1 ON download_version(download_id);

    COMMENT ON TABLE download_version IS 'A point-in-time version of a download. A version is the temporal axis — it re-snapshots the same invariant policy later to pick up newly uploaded features; the policy itself is never recorded per version.';
    COMMENT ON COLUMN download_version.download_version_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_version.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_version.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_version.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_version.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_version.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_version.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_version.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD.CURRENT_DOWNLOAD_VERSION_ID
    --------------------------------------------------------------------------------

    ALTER TABLE download ADD COLUMN current_download_version_id UUID;

    ALTER TABLE download ADD CONSTRAINT download_current_download_version_fk
      FOREIGN KEY (current_download_version_id) REFERENCES download_version(download_version_id);

    CREATE INDEX download_idx4 ON download(current_download_version_id);

    COMMENT ON COLUMN download.current_download_version_id IS 'Points at the download''s currently-materialized version. Nullable because the download row is inserted before its version within the create transaction; set once the version exists.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_VERSION_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE download_version_artifact (
      download_version_artifact_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_version_id UUID NOT NULL,
      artifact_id UUID NOT NULL,
      feature_type_name VARCHAR(200),
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_version_artifact_pk PRIMARY KEY (download_version_artifact_id),
      CONSTRAINT download_version_artifact_fk1 FOREIGN KEY (download_version_id) REFERENCES download_version(download_version_id),
      CONSTRAINT download_version_artifact_fk2 FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    CREATE UNIQUE INDEX download_version_artifact_nuk1
      ON download_version_artifact (download_version_id, artifact_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_version_artifact_idx1 ON download_version_artifact(download_version_id);
    CREATE INDEX download_version_artifact_idx2 ON download_version_artifact(artifact_id);

    COMMENT ON TABLE download_version_artifact IS 'Join table linking a download version to the raw artifacts that make up its snapshot.';
    COMMENT ON COLUMN download_version_artifact.download_version_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_version_artifact.download_version_id IS 'Foreign key to the download_version table.';
    COMMENT ON COLUMN download_version_artifact.artifact_id IS 'Foreign key to the artifact table.';
    COMMENT ON COLUMN download_version_artifact.feature_type_name IS 'Name of the feature type this artifact belongs to. Null when the artifact is not scoped to a single feature type.';
    COMMENT ON COLUMN download_version_artifact.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_version_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_version_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_version_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_version_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_version_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_VERSION_EXPORT_ARTIFACT_GROUP
    --------------------------------------------------------------------------------

    CREATE TABLE download_version_export_artifact_group (
      download_version_export_artifact_group_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_version_id UUID NOT NULL,
      format VARCHAR(50) NOT NULL,
      mode VARCHAR(32) NOT NULL,
      max_part_size_bytes BIGINT NOT NULL DEFAULT 524288000,
      exporter_version INTEGER NOT NULL DEFAULT 1,
      status download_status NOT NULL DEFAULT 'pending',
      started_at TIMESTAMPTZ(6),
      completed_at TIMESTAMPTZ(6),
      error_message TEXT,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_version_export_artifact_group_pk PRIMARY KEY (download_version_export_artifact_group_id),
      CONSTRAINT download_version_export_artifact_group_fk1 FOREIGN KEY (download_version_id) REFERENCES download_version(download_version_id),
      CONSTRAINT download_version_export_artifact_group_mode_check CHECK (mode IN ('per_feature_type', 'denormalized'))
    );

    CREATE UNIQUE INDEX download_version_export_artifact_group_nuk1
      ON download_version_export_artifact_group (download_version_id, format, mode, max_part_size_bytes, exporter_version)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_version_export_artifact_group_idx1 ON download_version_export_artifact_group(download_version_id);
    CREATE INDEX download_version_export_artifact_group_idx2 ON download_version_export_artifact_group(status);

    COMMENT ON TABLE download_version_export_artifact_group IS 'A materialized set of export artifacts for one download version, keyed by export shape. Identical requests dedupe onto the active group rather than rebuilding.';
    COMMENT ON COLUMN download_version_export_artifact_group.download_version_export_artifact_group_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_version_export_artifact_group.download_version_id IS 'Foreign key to the download_version table.';
    COMMENT ON COLUMN download_version_export_artifact_group.format IS 'Export output format (e.g. csv).';
    COMMENT ON COLUMN download_version_export_artifact_group.mode IS 'Export shape discriminator. ''per_feature_type'' = one logical CSV per feature type (star). ''denormalized'' = single flat CSV with user-selected columns pre-joined across feature types (future). CHECK constraint bounds the set to prevent typos reaching the pipeline.';
    COMMENT ON COLUMN download_version_export_artifact_group.max_part_size_bytes IS 'Maximum size in bytes of each exported part-zip. The pipeline rolls to a new part once a part reaches this threshold. Default 500 MB (524288000).';
    COMMENT ON COLUMN download_version_export_artifact_group.exporter_version IS 'Cache-invalidation key — part of the active-group dedupe key. Bumping the EXPORTER_VERSION constant on any change to the CSV/zip packing logic makes the next identical request miss the stale ready group and rebuild.';
    COMMENT ON COLUMN download_version_export_artifact_group.status IS 'Lifecycle status lives on the group, not the per-user export; attaching a new export to a ready group yields a ready export with no status write.';
    COMMENT ON COLUMN download_version_export_artifact_group.started_at IS 'Timestamp when the export job began processing.';
    COMMENT ON COLUMN download_version_export_artifact_group.completed_at IS 'Timestamp when the export job finished (success or failure).';
    COMMENT ON COLUMN download_version_export_artifact_group.error_message IS 'Error details if the export job failed.';
    COMMENT ON COLUMN download_version_export_artifact_group.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_version_export_artifact_group.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_version_export_artifact_group.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_version_export_artifact_group.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_version_export_artifact_group.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_version_export_artifact_group.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_VERSION_EXPORT
    --------------------------------------------------------------------------------

    CREATE TABLE download_version_export (
      download_version_export_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_version_id UUID NOT NULL,
      download_version_export_artifact_group_id UUID,
      format VARCHAR(50) NOT NULL,
      mode VARCHAR(32) NOT NULL,
      max_part_size_bytes BIGINT NOT NULL DEFAULT 524288000,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_version_export_pk PRIMARY KEY (download_version_export_id),
      CONSTRAINT download_version_export_fk1 FOREIGN KEY (download_version_id) REFERENCES download_version(download_version_id),
      CONSTRAINT download_version_export_fk2 FOREIGN KEY (download_version_export_artifact_group_id) REFERENCES download_version_export_artifact_group(download_version_export_artifact_group_id),
      CONSTRAINT download_version_export_mode_check CHECK (mode IN ('per_feature_type', 'denormalized'))
    );

    CREATE INDEX download_version_export_idx1 ON download_version_export(download_version_id);
    CREATE INDEX download_version_export_idx2 ON download_version_export(download_version_export_artifact_group_id);

    COMMENT ON TABLE download_version_export IS 'A per-user request for an export shape against a download version. Carries no status — lifecycle lives on the artifact group it attaches to.';
    COMMENT ON COLUMN download_version_export.download_version_export_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_version_export.download_version_id IS 'Foreign key to the download_version table.';
    COMMENT ON COLUMN download_version_export.download_version_export_artifact_group_id IS 'Foreign key to the download_version_export_artifact_group table. Nullable until the export is attached to a materialized group.';
    COMMENT ON COLUMN download_version_export.format IS 'Export output format (e.g. csv).';
    COMMENT ON COLUMN download_version_export.mode IS 'Export shape discriminator. ''per_feature_type'' = one logical CSV per feature type (star). ''denormalized'' = single flat CSV with user-selected columns pre-joined across feature types (future). CHECK constraint bounds the set to prevent typos reaching the pipeline.';
    COMMENT ON COLUMN download_version_export.max_part_size_bytes IS 'Maximum size in bytes of each exported part-zip. The pipeline rolls to a new part once a part reaches this threshold. Default 500 MB (524288000).';
    COMMENT ON COLUMN download_version_export.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_version_export.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_version_export.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_version_export.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_version_export.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_version_export.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_VERSION_EXPORT_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE download_version_export_artifact (
      download_version_export_artifact_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_version_export_artifact_group_id UUID NOT NULL,
      artifact_id UUID NOT NULL,
      chunk_id INTEGER NOT NULL,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_version_export_artifact_pk PRIMARY KEY (download_version_export_artifact_id),
      CONSTRAINT download_version_export_artifact_fk1 FOREIGN KEY (download_version_export_artifact_group_id) REFERENCES download_version_export_artifact_group(download_version_export_artifact_group_id),
      CONSTRAINT download_version_export_artifact_fk2 FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    CREATE UNIQUE INDEX download_version_export_artifact_nuk1
      ON download_version_export_artifact (download_version_export_artifact_group_id, artifact_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_version_export_artifact_idx1 ON download_version_export_artifact(download_version_export_artifact_group_id);
    CREATE INDEX download_version_export_artifact_idx2 ON download_version_export_artifact(artifact_id);

    COMMENT ON TABLE download_version_export_artifact IS 'Join table linking an export artifact group to the artifact chunks that make up its packaged output. chunk_id enables checkpoint restart on failure.';
    COMMENT ON COLUMN download_version_export_artifact.download_version_export_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_version_export_artifact.download_version_export_artifact_group_id IS 'Foreign key to the download_version_export_artifact_group table.';
    COMMENT ON COLUMN download_version_export_artifact.artifact_id IS 'Foreign key to the artifact table.';
    COMMENT ON COLUMN download_version_export_artifact.chunk_id IS 'Sequential chunk identifier within an export job. Enables checkpoint restart on failure.';
    COMMENT ON COLUMN download_version_export_artifact.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_version_export_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_version_export_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_version_export_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_version_export_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_version_export_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_download_version
      BEFORE INSERT OR UPDATE OR DELETE ON download_version
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_version
      AFTER INSERT OR UPDATE OR DELETE ON download_version
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_version_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON download_version_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_version_artifact
      AFTER INSERT OR UPDATE OR DELETE ON download_version_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_version_export_artifact_group
      BEFORE INSERT OR UPDATE OR DELETE ON download_version_export_artifact_group
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_version_export_artifact_group
      AFTER INSERT OR UPDATE OR DELETE ON download_version_export_artifact_group
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_version_export
      BEFORE INSERT OR UPDATE OR DELETE ON download_version_export
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_version_export
      AFTER INSERT OR UPDATE OR DELETE ON download_version_export
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_version_export_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON download_version_export_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_version_export_artifact
      AFTER INSERT OR UPDATE OR DELETE ON download_version_export_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DROP VERSION-AWARE TABLES (reverse dependency order — triggers/indexes drop with their tables)
    --------------------------------------------------------------------------------

    DROP TABLE IF EXISTS download_version_export_artifact;
    DROP TABLE IF EXISTS download_version_export;
    DROP TABLE IF EXISTS download_version_export_artifact_group;
    DROP TABLE IF EXISTS download_version_artifact;

    --------------------------------------------------------------------------------
    -- DROP DOWNLOAD.CURRENT_DOWNLOAD_VERSION_ID (FK + index drop with the column)
    --------------------------------------------------------------------------------

    ALTER TABLE download DROP CONSTRAINT IF EXISTS download_current_download_version_fk;
    DROP INDEX IF EXISTS download_idx4;
    ALTER TABLE download DROP COLUMN IF EXISTS current_download_version_id;

    DROP TABLE IF EXISTS download_version;

    --------------------------------------------------------------------------------
    -- RECREATE LEGACY DOWNLOAD_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE download_artifact (
      download_artifact_id INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id UUID NOT NULL,
      artifact_id UUID NOT NULL,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_artifact_pk PRIMARY KEY (download_artifact_id),
      CONSTRAINT download_artifact_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id),
      CONSTRAINT download_artifact_fk2 FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    CREATE UNIQUE INDEX download_artifact_nuk1
      ON download_artifact (download_id, artifact_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_artifact_idx1 ON download_artifact(download_id);
    CREATE INDEX download_artifact_idx2 ON download_artifact(artifact_id);

    COMMENT ON TABLE download_artifact IS 'Join table linking downloads to artifacts. A pending artifact is created at download request time, before any file exists.';
    COMMENT ON COLUMN download_artifact.download_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_artifact.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_artifact.artifact_id IS 'Foreign key to the artifact table.';
    COMMENT ON COLUMN download_artifact.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- RECREATE LEGACY DOWNLOAD_EXPORT (base + chunk-size/mode columns from later migration)
    --------------------------------------------------------------------------------

    CREATE TABLE download_export (
      download_export_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_id UUID NOT NULL,
      format VARCHAR(50) NOT NULL,
      status download_status NOT NULL DEFAULT 'pending',
      max_part_size_bytes BIGINT NOT NULL DEFAULT 524288000,
      mode VARCHAR(32) NOT NULL DEFAULT 'per_feature_type',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_export_pk PRIMARY KEY (download_export_id),
      CONSTRAINT download_export_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id),
      CONSTRAINT download_export_mode_check CHECK (mode IN ('per_feature_type', 'denormalized'))
    );

    CREATE INDEX download_export_idx1 ON download_export(download_id);
    CREATE INDEX download_export_idx2 ON download_export(status);

    COMMENT ON TABLE download_export IS 'Tracks per-download format conversion jobs. Tables exist for future export pipeline; export job creation comes in a follow-up ticket that replaces the current fragment-based approach.';
    COMMENT ON COLUMN download_export.download_export_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_export.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_export.format IS 'Export output format (e.g. parquet, csv).';
    COMMENT ON COLUMN download_export.status IS 'Lifecycle status of the export job. Reuses the download_status enum.';
    COMMENT ON COLUMN download_export.max_part_size_bytes IS 'Maximum size in bytes of each exported part-zip. The pipeline rolls to a new part once a part reaches this threshold. Default 500 MB (524288000). Per-export knob — a single download can be re-exported at different part sizes. Distinct from download.fragment_size_bytes, which is the Parquet write-pipeline equivalent.';
    COMMENT ON COLUMN download_export.mode IS 'Export shape discriminator. ''per_feature_type'' = one logical CSV per feature type (star). ''denormalized'' = single flat CSV with user-selected columns pre-joined across feature types (future). CHECK constraint bounds the set to prevent typos reaching the pipeline.';
    COMMENT ON COLUMN download_export.started_at IS 'Timestamp when the export job began processing.';
    COMMENT ON COLUMN download_export.completed_at IS 'Timestamp when the export job finished (success or failure).';
    COMMENT ON COLUMN download_export.error_message IS 'Error details if the export job failed.';
    COMMENT ON COLUMN download_export.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_export.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_export.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_export.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_export.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- RECREATE LEGACY DOWNLOAD_EXPORT_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE download_export_artifact (
      download_export_artifact_id INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_export_id UUID NOT NULL,
      artifact_id UUID NOT NULL,
      chunk_id INTEGER,
      record_end_date TIMESTAMPTZ(6),
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_export_artifact_pk PRIMARY KEY (download_export_artifact_id),
      CONSTRAINT download_export_artifact_fk1 FOREIGN KEY (download_export_id) REFERENCES download_export(download_export_id),
      CONSTRAINT download_export_artifact_fk2 FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    CREATE UNIQUE INDEX download_export_artifact_nuk1
      ON download_export_artifact (download_export_id, artifact_id)
      WHERE record_end_date IS NULL;

    CREATE INDEX download_export_artifact_idx1 ON download_export_artifact(download_export_id);
    CREATE INDEX download_export_artifact_idx2 ON download_export_artifact(artifact_id);

    COMMENT ON TABLE download_export_artifact IS 'Join table linking export jobs to artifact chunks. chunk_id enables checkpoint restart — if an export fails at chunk 10, the next attempt can resume from chunk 11.';
    COMMENT ON COLUMN download_export_artifact.download_export_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_export_artifact.download_export_id IS 'Foreign key to the download_export table.';
    COMMENT ON COLUMN download_export_artifact.artifact_id IS 'Foreign key to the artifact table.';
    COMMENT ON COLUMN download_export_artifact.chunk_id IS 'Sequential chunk identifier within an export job. Enables checkpoint restart on failure.';
    COMMENT ON COLUMN download_export_artifact.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_export_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_export_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_export_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_export_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_export_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- RECREATE LEGACY AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_download_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON download_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_artifact
      AFTER INSERT OR UPDATE OR DELETE ON download_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_export
      BEFORE INSERT OR UPDATE OR DELETE ON download_export
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_export
      AFTER INSERT OR UPDATE OR DELETE ON download_export
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_download_export_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON download_export_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_download_export_artifact
      AFTER INSERT OR UPDATE OR DELETE ON download_export_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}
