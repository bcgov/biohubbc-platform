import { Knex } from 'knex';

/**
 * Migration to drop the deprecated fragment-based download flow.
 *
 * Removes:
 * - download_fragment_feature (join table)
 * - download_fragment (per-fragment status tracking)
 * - download.total_fragments / completed_fragments / fragment_size_bytes /
 *   estimated_total_size_bytes columns
 *
 * The fragment flow was superseded by the snapshot-Parquet + download_export
 * pipeline (SIMSBIOHUB-953/954). No data preserved — fragments are transient
 * processing state and the tables are 0-row at the time of this migration.
 *
 * See: SIMSBIOHUB-956
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- SIMSBIOHUB-956: Remove the fragment-based download flow superseded by
    -- the snapshot-Parquet + download_export pipeline (953/954). No data
    -- preserved — fragments are transient processing state.
    --------------------------------------------------------------------------------

    --------------------------------------------------------------------------------
    -- Drop triggers
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS audit_download_fragment_feature ON download_fragment_feature;
    DROP TRIGGER IF EXISTS journal_download_fragment_feature ON download_fragment_feature;
    DROP TRIGGER IF EXISTS audit_download_fragment ON download_fragment;
    DROP TRIGGER IF EXISTS journal_download_fragment ON download_fragment;

    --------------------------------------------------------------------------------
    -- Drop tables (indexes drop automatically with their tables)
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS download_fragment_feature;
    DROP TABLE IF EXISTS download_fragment;

    --------------------------------------------------------------------------------
    -- Drop fragment-related columns from download
    --------------------------------------------------------------------------------
    ALTER TABLE download
      DROP COLUMN IF EXISTS total_fragments,
      DROP COLUMN IF EXISTS completed_fragments,
      DROP COLUMN IF EXISTS fragment_size_bytes,
      DROP COLUMN IF EXISTS estimated_total_size_bytes;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- Re-add the dropped download columns with their pre-drop constraints/defaults
    --------------------------------------------------------------------------------
    ALTER TABLE download
      ADD COLUMN total_fragments            INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN completed_fragments        INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN fragment_size_bytes        BIGINT  NOT NULL DEFAULT 524288000,
      ADD COLUMN estimated_total_size_bytes BIGINT;

    --------------------------------------------------------------------------------
    -- Create download_fragment table
    --------------------------------------------------------------------------------
    CREATE TABLE download_fragment (
      download_fragment_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      download_id             UUID NOT NULL,
      fragment_index          INTEGER NOT NULL,
      fragment_status         download_status NOT NULL DEFAULT 'pending',
      s3_key                  VARCHAR(500),
      file_name               VARCHAR(255),
      file_size_bytes         BIGINT,
      estimated_size_bytes    BIGINT,
      feature_count           INTEGER NOT NULL DEFAULT 0,
      started_at              TIMESTAMPTZ,
      completed_at            TIMESTAMPTZ,
      error_message           TEXT,
      create_date             TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user             INTEGER NOT NULL,
      update_date             TIMESTAMPTZ,
      update_user             INTEGER,
      revision_count          INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_fragment_fk1
        FOREIGN KEY (download_id) REFERENCES download(download_id) ON DELETE CASCADE,

      CONSTRAINT download_fragment_uk1
        UNIQUE (download_id, fragment_index)
    );

    --------------------------------------------------------------------------------
    -- Create download_fragment indexes
    --------------------------------------------------------------------------------
    CREATE INDEX download_fragment_idx1 ON download_fragment(download_id);

    --------------------------------------------------------------------------------
    -- Add download_fragment triggers
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download_fragment
      BEFORE INSERT OR UPDATE OR DELETE ON download_fragment
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download_fragment
      AFTER INSERT OR UPDATE OR DELETE ON download_fragment
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Download fragment table comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download_fragment IS 'Tracks individual zip fragments within a download. Small downloads have one fragment; large downloads are split into multiple ~500MB fragments.';
    COMMENT ON COLUMN download_fragment.download_fragment_id IS 'Primary key.';
    COMMENT ON COLUMN download_fragment.download_id IS 'Foreign key to download table.';
    COMMENT ON COLUMN download_fragment.fragment_index IS 'Zero-based ordering index for this fragment within the download.';
    COMMENT ON COLUMN download_fragment.fragment_status IS 'Fragment processing status: pending, processing, ready, or failed.';
    COMMENT ON COLUMN download_fragment.s3_key IS 'Object storage key for the generated zip fragment.';
    COMMENT ON COLUMN download_fragment.file_name IS 'Name of the generated zip fragment file.';
    COMMENT ON COLUMN download_fragment.file_size_bytes IS 'Actual size of the generated zip fragment in bytes.';
    COMMENT ON COLUMN download_fragment.estimated_size_bytes IS 'Estimated size of the fragment in bytes, calculated before processing.';
    COMMENT ON COLUMN download_fragment.feature_count IS 'Number of features assigned to this fragment.';
    COMMENT ON COLUMN download_fragment.started_at IS 'Timestamp when fragment processing began.';
    COMMENT ON COLUMN download_fragment.completed_at IS 'Timestamp when fragment processing completed.';
    COMMENT ON COLUMN download_fragment.error_message IS 'Error message if fragment processing failed.';

    --------------------------------------------------------------------------------
    -- Create download_fragment_feature table
    --------------------------------------------------------------------------------
    CREATE TABLE download_fragment_feature (
      download_fragment_feature_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      download_fragment_id            INTEGER NOT NULL,
      submission_feature_id           INTEGER NOT NULL,
      create_date                     TIMESTAMPTZ NOT NULL DEFAULT now(),
      create_user                     INTEGER NOT NULL,
      update_date                     TIMESTAMPTZ,
      update_user                     INTEGER,
      revision_count                  INTEGER NOT NULL DEFAULT 0,

      CONSTRAINT download_fragment_feature_fk1
        FOREIGN KEY (download_fragment_id) REFERENCES download_fragment(download_fragment_id) ON DELETE CASCADE,

      CONSTRAINT download_fragment_feature_fk2
        FOREIGN KEY (submission_feature_id) REFERENCES submission_feature(submission_feature_id)
    );

    --------------------------------------------------------------------------------
    -- Create download_fragment_feature indexes
    --------------------------------------------------------------------------------
    CREATE INDEX download_fragment_feature_idx1 ON download_fragment_feature(download_fragment_id);
    CREATE INDEX download_fragment_feature_idx2 ON download_fragment_feature(submission_feature_id);

    --------------------------------------------------------------------------------
    -- Add download_fragment_feature triggers
    --------------------------------------------------------------------------------
    CREATE TRIGGER audit_download_fragment_feature
      BEFORE INSERT OR UPDATE OR DELETE ON download_fragment_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();

    CREATE TRIGGER journal_download_fragment_feature
      AFTER INSERT OR UPDATE OR DELETE ON download_fragment_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- Download fragment feature table comments
    --------------------------------------------------------------------------------
    COMMENT ON TABLE download_fragment_feature IS 'Join table linking download fragments to submission features assigned to each fragment.';
    COMMENT ON COLUMN download_fragment_feature.download_fragment_feature_id IS 'Primary key.';
    COMMENT ON COLUMN download_fragment_feature.download_fragment_id IS 'Foreign key to download_fragment table.';
    COMMENT ON COLUMN download_fragment_feature.submission_feature_id IS 'Foreign key to submission_feature table.';
  `);
}
