import { Knex } from 'knex';

/**
 * Migration to create download pipeline tables:
 * - download: tracks background job status for download packaging requests
 * - download_feature: links downloads to selected submission features
 * - download_share: ad-hoc sharing grants for individual users
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
      'processing',  -- Actively being processed
      'ready',       -- Package created, available for download
      'downloaded',  -- User has downloaded the package
      'failed'       -- Processing failed
    );

    --------------------------------------------------------------------------------
    -- Create download table
    --------------------------------------------------------------------------------
    CREATE TABLE download (
      download_id             UUID DEFAULT gen_random_uuid(),
      system_user_id          INTEGER,
      team_id                 UUID,
      data_request_id         UUID,
      download_status         download_status NOT NULL DEFAULT 'pending',
      metadata                JSONB,
      total_fragments         INTEGER NOT NULL DEFAULT 1,
      completed_fragments     INTEGER NOT NULL DEFAULT 0,
      estimated_total_size_bytes BIGINT,
      fragment_size_bytes     BIGINT NOT NULL DEFAULT 524288000,
      started_at              TIMESTAMPTZ,
      completed_at            TIMESTAMPTZ,
      downloaded_at           TIMESTAMPTZ,
      create_date             TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user             INTEGER NOT NULL,
      record_end_date         TIMESTAMPTZ,
      update_date             TIMESTAMPTZ,
      update_user             INTEGER,
      revision_count          INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_pk PRIMARY KEY (download_id),

      CONSTRAINT download_system_user_fk
        FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id),

      CONSTRAINT download_team_fk
        FOREIGN KEY (team_id) REFERENCES team(team_id)
    );

    --------------------------------------------------------------------------------
    -- Create download indexes
    --------------------------------------------------------------------------------
    CREATE INDEX download_system_user_idx ON download(system_user_id);
    CREATE INDEX download_idx1 ON download(team_id);
    CREATE INDEX download_idx2 ON download(download_status);
    CREATE INDEX download_idx3 ON download(data_request_id);

    --------------------------------------------------------------------------------
    -- Add download triggers
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download
      BEFORE INSERT OR UPDATE OR DELETE ON download
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download
      AFTER INSERT OR UPDATE OR DELETE ON download
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Download table comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download IS 'Tracks background job status for download packaging requests.';
    COMMENT ON COLUMN download.download_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN download.system_user_id IS 'Foreign key to the system user who created or claimed this download. Null for anonymous downloads.';
    COMMENT ON COLUMN download.team_id IS 'Foreign key to the team that owns this download. Null for anonymous downloads.';
    COMMENT ON COLUMN download.data_request_id IS 'Foreign key to the data request that originated this download. Null for non-request downloads.';
    COMMENT ON COLUMN download.download_status IS 'Download status: pending, ready, downloaded, or failed.';
    COMMENT ON COLUMN download.metadata IS 'JSON metadata containing error messages or processing details.';
    COMMENT ON COLUMN download.total_fragments IS 'Total number of zip fragments for this download.';
    COMMENT ON COLUMN download.completed_fragments IS 'Number of fragments that have completed processing.';
    COMMENT ON COLUMN download.estimated_total_size_bytes IS 'Estimated total size in bytes, calculated before processing.';
    COMMENT ON COLUMN download.fragment_size_bytes IS 'Target fragment size in bytes. Default 500 MB (524288000). Users may choose 500 MB, 1 GB, or 5 GB.';
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

    CREATE INDEX download_feature_idx1 ON download_feature(download_id);
    CREATE INDEX download_feature_idx2 ON download_feature(submission_feature_id);

    CREATE TRIGGER audit_download_feature
      BEFORE INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download_feature
      AFTER INSERT OR UPDATE OR DELETE ON download_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    COMMENT ON TABLE download_feature IS 'Join table linking download requests to selected submission features.';
    COMMENT ON COLUMN download_feature.download_feature_id IS 'Primary key.';
    COMMENT ON COLUMN download_feature.download_id IS 'Foreign key to download table.';
    COMMENT ON COLUMN download_feature.submission_feature_id IS 'Foreign key to submission_feature table.';

    --------------------------------------------------------------------------------
    -- Create download_share table
    --------------------------------------------------------------------------------
    CREATE TABLE download_share (
      download_share_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      download_id             UUID NOT NULL,
      system_user_id          INTEGER NOT NULL,
      record_end_date         TIMESTAMPTZ,
      create_date             TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user             INTEGER NOT NULL,
      update_date             TIMESTAMPTZ,
      update_user             INTEGER,
      revision_count          INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_share_fk1
        FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,

      CONSTRAINT download_share_fk2
        FOREIGN KEY (system_user_id) REFERENCES "system_user"(system_user_id),

      CONSTRAINT download_share_uk1
        UNIQUE (download_id, system_user_id)
    );

    CREATE INDEX download_share_idx1 ON download_share(download_id);
    CREATE INDEX download_share_idx2 ON download_share(system_user_id);

    CREATE TRIGGER audit_download_share
      BEFORE INSERT OR UPDATE OR DELETE ON download_share
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download_share
      AFTER INSERT OR UPDATE OR DELETE ON download_share
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    COMMENT ON TABLE download_share IS 'Ad-hoc sharing grants giving individual users access to a specific download.';
    COMMENT ON COLUMN download_share.download_share_id IS 'Primary key.';
    COMMENT ON COLUMN download_share.download_id IS 'Foreign key to download table.';
    COMMENT ON COLUMN download_share.system_user_id IS 'Foreign key to system_user table. The user being granted access.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    DROP TABLE IF EXISTS download_share CASCADE;
    DROP TABLE IF EXISTS download_feature CASCADE;
    DROP TABLE IF EXISTS download CASCADE;
    DROP TYPE IF EXISTS download_status;
  `);
}
