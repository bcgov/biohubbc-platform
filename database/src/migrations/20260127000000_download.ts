import { Knex } from 'knex';

/**
 * Migration to create download and download_feature tables for tracking
 * download request processing status.
 *
 * These tables support the download pipeline:
 * - Status tracking for background download packaging jobs
 * - Link to pg-boss job for resync capability
 * - Join table linking downloads to selected submission features
 *
 * See: SIMSBIOHUB-823
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Create download_status enum
    --------------------------------------------------------------------------------
    CREATE TYPE download_status AS ENUM (
      'pending',     -- Queued for processing
      'ready',       -- Package created, available for download
      'downloaded',  -- User has downloaded the package
      'failed'       -- Processing failed
    );

    --------------------------------------------------------------------------------
    -- Create download table
    --------------------------------------------------------------------------------
    CREATE TABLE download (
      download_id         UUID DEFAULT gen_random_uuid(),
      system_user_id      INTEGER,
      download_status     download_status NOT NULL DEFAULT 'pending',
      s3_key              VARCHAR(500),
      file_name           VARCHAR(255),
      file_size_bytes     BIGINT,
      metadata            JSONB,
      started_at          TIMESTAMPTZ,
      completed_at        TIMESTAMPTZ,
      downloaded_at       TIMESTAMPTZ,
      create_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user         INTEGER NOT NULL,
      record_end_date     TIMESTAMPTZ,
      update_date         TIMESTAMPTZ,
      update_user         INTEGER,
      revision_count      INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_pk PRIMARY KEY (download_id),

      CONSTRAINT download_fk1
        FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id)
    );

    --------------------------------------------------------------------------------
    -- Create download indexes
    --------------------------------------------------------------------------------
    CREATE INDEX download_idx1 ON download(system_user_id);
    CREATE INDEX download_idx2 ON download(download_status);

    --------------------------------------------------------------------------------
    -- Add download audit trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download
      BEFORE INSERT OR UPDATE OR DELETE ON download
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    --------------------------------------------------------------------------------
    -- Add download journal trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER journal_download
      AFTER INSERT OR UPDATE OR DELETE ON download
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Download table comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download IS 'Tracks background job status for download packaging requests.';
    COMMENT ON COLUMN download.download_id IS 'Primary key.';
    COMMENT ON COLUMN download.system_user_id IS 'Foreign key to system_user table. The user who initiated the download. Null for anonymous downloads.';
    COMMENT ON COLUMN download.download_status IS 'Download status: pending, ready, downloaded, or failed.';
    COMMENT ON COLUMN download.s3_key IS 'Object storage key for the generated zip file.';
    COMMENT ON COLUMN download.file_name IS 'Name of the generated zip file.';
    COMMENT ON COLUMN download.file_size_bytes IS 'Size of the generated zip file in bytes.';
    COMMENT ON COLUMN download.metadata IS 'JSON metadata containing error messages or processing details.';
    COMMENT ON COLUMN download.started_at IS 'Timestamp when download packaging began.';
    COMMENT ON COLUMN download.completed_at IS 'Timestamp when download packaging completed.';
    COMMENT ON COLUMN download.downloaded_at IS 'Timestamp when the client downloaded the file.';
    COMMENT ON COLUMN download.record_end_date IS 'The date the record was soft-deleted.';

    --------------------------------------------------------------------------------
    -- Create download_feature table
    --------------------------------------------------------------------------------
    CREATE TABLE download_feature (
      download_feature_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      download_id               UUID NOT NULL,
      submission_feature_id     INTEGER NOT NULL,
      create_date               TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user               INTEGER NOT NULL,
      update_date               TIMESTAMPTZ,
      update_user               INTEGER,
      revision_count            INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_feature_fk1
        FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,

      CONSTRAINT download_feature_fk2
        FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    --------------------------------------------------------------------------------
    -- Create download_feature indexes
    --------------------------------------------------------------------------------
    CREATE INDEX download_feature_idx1 ON download_feature(download_id);

    --------------------------------------------------------------------------------
    -- Add download_feature audit trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download_feature
      BEFORE INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    --------------------------------------------------------------------------------
    -- Add download_feature journal trigger
    --------------------------------------------------------------------------------
    CREATE TRIGGER journal_download_feature
      AFTER INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Download feature table comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download_feature IS 'Join table linking download requests to selected submission features.';
    COMMENT ON COLUMN download_feature.download_feature_id IS 'Primary key.';
    COMMENT ON COLUMN download_feature.download_id IS 'Foreign key to download table.';
    COMMENT ON COLUMN download_feature.submission_feature_id IS 'Foreign key to submission_feature table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS download_feature CASCADE;
    DROP TABLE IF EXISTS download CASCADE;
    DROP TYPE IF EXISTS download_status;
  `);
}
