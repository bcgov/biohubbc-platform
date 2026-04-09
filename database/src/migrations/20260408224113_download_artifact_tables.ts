import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- DOWNLOAD_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE download_artifact (
      download_artifact_id INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
      download_id UUID NOT NULL,
      artifact_id UUID NOT NULL,
      format VARCHAR(50) NOT NULL,
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
    COMMENT ON COLUMN download_artifact.format IS 'Artifact format (e.g. parquet). Currently only parquet, but supports future formats (tif, zarr) for spatial data exports where parquet is not ideal.';
    COMMENT ON COLUMN download_artifact.record_end_date IS 'Timestamp for soft delete; null when record is active.';
    COMMENT ON COLUMN download_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_EXPORT
    --------------------------------------------------------------------------------

    CREATE TABLE download_export (
      download_export_id UUID DEFAULT gen_random_uuid() NOT NULL,
      download_id UUID NOT NULL,
      format VARCHAR(50) NOT NULL,
      status download_status NOT NULL DEFAULT 'pending',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      create_date TIMESTAMPTZ(6) DEFAULT now() NOT NULL,
      create_user INTEGER NOT NULL,
      update_date TIMESTAMPTZ(6),
      update_user INTEGER,
      revision_count INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT download_export_pk PRIMARY KEY (download_export_id),
      CONSTRAINT download_export_fk1 FOREIGN KEY (download_id) REFERENCES download(download_id)
    );

    CREATE INDEX download_export_idx1 ON download_export(download_id);
    CREATE INDEX download_export_idx2 ON download_export(status);

    COMMENT ON TABLE download_export IS 'Tracks per-download format conversion jobs. Tables exist for future export pipeline; export job creation comes in a follow-up ticket that replaces the current fragment-based approach.';
    COMMENT ON COLUMN download_export.download_export_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download_export.download_id IS 'Foreign key to the download table.';
    COMMENT ON COLUMN download_export.format IS 'Export output format (e.g. parquet, csv).';
    COMMENT ON COLUMN download_export.status IS 'Lifecycle status of the export job. Reuses the download_status enum.';
    COMMENT ON COLUMN download_export.started_at IS 'Timestamp when the export job began processing.';
    COMMENT ON COLUMN download_export.completed_at IS 'Timestamp when the export job finished (success or failure).';
    COMMENT ON COLUMN download_export.error_message IS 'Error details if the export job failed.';
    COMMENT ON COLUMN download_export.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN download_export.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN download_export.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN download_export.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN download_export.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- DOWNLOAD_EXPORT_ARTIFACT
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
    -- AUDIT / JOURNAL TRIGGERS
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

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- Drop triggers
    DROP TRIGGER IF EXISTS journal_download_export_artifact ON download_export_artifact;
    DROP TRIGGER IF EXISTS audit_download_export_artifact ON download_export_artifact;
    DROP TRIGGER IF EXISTS journal_download_export ON download_export;
    DROP TRIGGER IF EXISTS audit_download_export ON download_export;
    DROP TRIGGER IF EXISTS journal_download_artifact ON download_artifact;
    DROP TRIGGER IF EXISTS audit_download_artifact ON download_artifact;

    -- Drop tables (reverse dependency order — indexes drop automatically with their tables)
    DROP TABLE IF EXISTS download_export_artifact;
    DROP TABLE IF EXISTS download_export;
    DROP TABLE IF EXISTS download_artifact;
  `);
}
