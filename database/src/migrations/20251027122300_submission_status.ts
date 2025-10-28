import { Knex } from 'knex';

/**
 * Creates the 'quarantine', 'quarantine_scan', and 'quarantine_scan_file' tables for tracking
 * quarantined tarball submissions, multiple scans per tarball, and individual file scan results.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    CREATE TYPE quarantine_status AS ENUM (
      -- used for records where files have not been uploaded
      'draft',
      -- used when files are uploaded and awaiting malware scan
      'pending',
      -- used when malware scan is in progress
      'scanning',
      -- used when malware scan completed and no threats were found
      'passed',
      -- used when malware scan completed and threats were found
      'rejected',
      -- used when malware scan failed due to error
      'failed'
    );

    CREATE TYPE scan_status AS ENUM (
      -- used when scan has not started
      'pending',
      -- used when scan is in progress
      'scanning',
      -- used when scan has finished successfully
      'completed',
      -- used when scan encountered an error
      'failed'
    );

    CREATE TYPE file_scan_result AS ENUM (
      -- used when file has not been scanned yet
      'pending',
      -- used when file was scanned and no threats were found
      'clean',
      -- used when file was scanned and threats were detected
      'infected',
      -- used when file scan encountered an error
      'error',
      -- used when file was not scanned (too large, excluded type, etc.)
      'skipped'
    );
    
    --------------------------------------------------------------------------------
    -- Create quarantine table
    --------------------------------------------------------------------------------

    CREATE TABLE quarantine (
      quarantine_id     uuid             DEFAULT public.gen_random_uuid(),
      uri               varchar(200)     NOT NULL,
      status            quarantine_status NOT NULL,
      upload_id         varchar(100),
      create_date       timestamptz(6)   DEFAULT now() NOT NULL,
      create_user       integer          NOT NULL,
      update_date       timestamptz(6),
      update_user       integer,
      revision_count    integer          DEFAULT 0 NOT NULL,
      CONSTRAINT quarantine_pk PRIMARY KEY (quarantine_id)
    );

    CREATE INDEX quarantine_status_idx ON quarantine(status);

    COMMENT ON TABLE quarantine IS 'Tracks quarantined tarball uploads awaiting or having completed security scanning.';
    COMMENT ON COLUMN quarantine.quarantine_id IS 'System-generated primary key.';
    COMMENT ON COLUMN quarantine.uri IS 'S3 URI or storage location for the quarantined tarball.';
    COMMENT ON COLUMN quarantine.status IS 'Overall status of the quarantine: pending (awaiting scan), scanning (in progress), passed (safe), rejected (threats found), failed (scan error).';
    COMMENT ON COLUMN quarantine.upload_id IS 'The upload ID used to completed the upload to the URI.';
    COMMENT ON COLUMN quarantine.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN quarantine.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN quarantine.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN quarantine.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN quarantine.revision_count IS 'Revision count used for concurrency control.';
    
    --------------------------------------------------------------------------------
    -- Create quarantine_scan table
    --------------------------------------------------------------------------------

    CREATE TABLE quarantine_scan (
      quarantine_scan_id uuid             DEFAULT public.gen_random_uuid(),
      quarantine_id      uuid             NOT NULL,
      scan_status        scan_status      NOT NULL,
      scanned_at         timestamptz(6),
      scanner_version    varchar(100),
      results            jsonb,
      create_date        timestamptz(6)   DEFAULT now() NOT NULL,
      create_user        integer          NOT NULL,
      update_date        timestamptz(6),
      update_user        integer,
      revision_count     integer          DEFAULT 0 NOT NULL,
      CONSTRAINT quarantine_scan_pk PRIMARY KEY (quarantine_scan_id),
      CONSTRAINT quarantine_scan_quarantine_fk FOREIGN KEY (quarantine_id) REFERENCES quarantine(quarantine_id)
    );

    CREATE INDEX quarantine_scan_quarantine_id_idx ON quarantine_scan(quarantine_id);
    CREATE INDEX quarantine_scan_scan_status_idx ON quarantine_scan(scan_status);
    CREATE INDEX quarantine_scan_scanned_at_idx ON quarantine_scan(scanned_at);

    COMMENT ON TABLE quarantine_scan IS 'Tracks individual scan attempts performed on quarantined tarballs. A quarantine record can be scanned multiple times.';
    COMMENT ON COLUMN quarantine_scan.quarantine_scan_id IS 'System-generated primary key.';
    COMMENT ON COLUMN quarantine_scan.quarantine_id IS 'Foreign key to the quarantine table.';
    COMMENT ON COLUMN quarantine_scan.scan_status IS 'Status of this scan attempt: pending (not started), scanning (in progress), completed (finished), failed (error occurred).';
    COMMENT ON COLUMN quarantine_scan.scanned_at IS 'Timestamp when this scan was completed.';
    COMMENT ON COLUMN quarantine_scan.scanner_version IS 'Version or identifier of the scanning engine used for this scan.';
    COMMENT ON COLUMN quarantine_scan.results IS 'Full ClamAV scan results in JSON format including summary statistics, infected files, and detailed scan information.';
    COMMENT ON COLUMN quarantine_scan.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN quarantine_scan.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN quarantine_scan.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN quarantine_scan.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN quarantine_scan.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Create quarantine_scan_file table
    --------------------------------------------------------------------------------

    CREATE TABLE quarantine_scan_file (
      quarantine_scan_file_id uuid             DEFAULT public.gen_random_uuid(),
      quarantine_scan_id      uuid             NOT NULL,
      file_path               text             NOT NULL,
      scan_result             file_scan_result NOT NULL,
      create_date             timestamptz(6)   DEFAULT now() NOT NULL,
      create_user             integer          NOT NULL,
      update_date             timestamptz(6),
      update_user             integer,
      revision_count          integer          DEFAULT 0 NOT NULL,
      CONSTRAINT quarantine_scan_file_pk PRIMARY KEY (quarantine_scan_file_id),
      CONSTRAINT quarantine_scan_file_quarantine_scan_fk FOREIGN KEY (quarantine_scan_id) REFERENCES quarantine_scan(quarantine_scan_id)
    );

    CREATE INDEX quarantine_scan_file_quarantine_scan_id_idx ON quarantine_scan_file(quarantine_scan_id);
    CREATE INDEX quarantine_scan_file_scan_result_idx ON quarantine_scan_file(scan_result);

    COMMENT ON TABLE quarantine_scan_file IS 'Tracks individual files extracted from quarantined tarballs and their scan results for a specific scan attempt.';
    COMMENT ON COLUMN quarantine_scan_file.quarantine_scan_file_id IS 'System-generated primary key.';
    COMMENT ON COLUMN quarantine_scan_file.quarantine_scan_id IS 'Foreign key to the quarantine_scan table.';
    COMMENT ON COLUMN quarantine_scan_file.file_path IS 'Path of the file within the tarball (e.g., /sites/1.jpg).';
    COMMENT ON COLUMN quarantine_scan_file.scan_result IS 'Result of scanning this file: pending (not yet scanned), clean (safe), infected (threat detected), error (scan failed), skipped (file too large or excluded).';
    COMMENT ON COLUMN quarantine_scan_file.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN quarantine_scan_file.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN quarantine_scan_file.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN quarantine_scan_file.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN quarantine_scan_file.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- Update submission table to reference quarantine
    --------------------------------------------------------------------------------
    
    ALTER TABLE submission ADD COLUMN quarantine_id uuid;
    ALTER TABLE submission ADD CONSTRAINT submission_quarantine_fk FOREIGN KEY (quarantine_id) REFERENCES quarantine(quarantine_id);

    CREATE INDEX submission_quarantine_id_idx ON submission(quarantine_id);
    
    COMMENT ON COLUMN submission.quarantine_id IS 'Foreign key to the quarantine table if this submission required security scanning.';

    --------------------------------------------------------------------------------
    -- Add audit triggers for each of the new tables
    --------------------------------------------------------------------------------
    
    CREATE TRIGGER audit_quarantine BEFORE INSERT OR UPDATE OR DELETE ON quarantine FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_quarantine AFTER INSERT OR UPDATE OR DELETE ON quarantine FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_quarantine_scan BEFORE INSERT OR UPDATE OR DELETE ON quarantine_scan FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_quarantine_scan AFTER INSERT OR UPDATE OR DELETE ON quarantine_scan FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
    CREATE TRIGGER audit_quarantine_scan_file BEFORE INSERT OR UPDATE OR DELETE ON quarantine_scan_file FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_quarantine_scan_file AFTER INSERT OR UPDATE OR DELETE ON quarantine_scan_file FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
    
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
