import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- ENUM TYPES
    --------------------------------------------------------------------------------

    -- Lifecycle status of an upload session
    CREATE TYPE upload_status AS ENUM (
      'pending',    -- Upload session created but not yet completed
      'completed',  -- Upload session finished successfully
      'aborted',    -- Upload session was canceled
      'expired',    -- Upload session expired without completion
      'failed'      -- Upload failed, eg. failed to generate presigned upload URL
    );

    -- Lifecycle status of an artifact
    CREATE TYPE artifact_status AS ENUM (
      'pending', 
      'uploaded',
      'deleted', 
      'failed',
      'archived'
    );

    -- Generic lifecycle status, related to background tasks
    CREATE TYPE process_status AS ENUM (
      'draft',      -- Not ready for processing
      'blocked',    -- Blocked by another task or condition
      'pending',    -- Awaiting processing
      'completed',  -- Processing complete
      'failed'      -- Processing failed
    );

    -- Security/security result status (for artifact_security, artifact_security_scan_file)
    CREATE TYPE security_status AS ENUM (
      'pending',    -- Scan queued but not yet performed
      'clean',      -- Scanned and found safe
      'infected',   -- Malware detected
      'error',      -- Scan failed or errored
      'skipped'     -- Scan intentionally skipped
    );

    -- Type of upload artifact in the submission tarball
    CREATE TYPE upload_artifact_role AS ENUM (
      'feature',  
      'attachment'
    );

    --------------------------------------------------------------------------------
    -- UPLOAD
    --------------------------------------------------------------------------------

    CREATE TABLE upload (
      upload_id uuid DEFAULT public.gen_random_uuid(),
      status upload_status NOT NULL,
      s3_upload_id VARCHAR(100),
      record_end_date timestamptz NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT upload_pk PRIMARY KEY (upload_id)
    );

    CREATE INDEX upload_status_idx ON upload(status);
    CREATE INDEX upload_s3_upload_idx ON upload(s3_upload_id);

    COMMENT ON TABLE upload IS 'Represents a temporary upload session used to generate presigned URLs.';
    COMMENT ON COLUMN upload.upload_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN upload.status IS 'Lifecycle state of the upload session.';
    COMMENT ON COLUMN upload.s3_upload_id IS 'Upload ID created while generating presigned upload URLs.';
    COMMENT ON COLUMN upload.record_end_date IS 'Timestamp after which the upload session is no longer valid.';
    COMMENT ON COLUMN upload.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN upload.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN upload.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN upload.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN upload.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE artifact (
      artifact_id uuid DEFAULT public.gen_random_uuid(),
      bucket varchar(200) NOT NULL,
      object_key text NOT NULL,
      byte_size bigint,
      checksum_sha256 varchar(64),
      status artifact_status NOT NULL,
      uploaded_at timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT artifact_pk PRIMARY KEY (artifact_id),
      CONSTRAINT artifact_bucket_key_uq UNIQUE (bucket, object_key),
      CONSTRAINT check_status_when_uploaded_at_null
        CHECK (
          uploaded_at IS NOT NULL OR status = 'pending'
        )
    );

    COMMENT ON TABLE artifact IS 'Immutable record representing a stored object in object storage.';
    COMMENT ON COLUMN artifact.artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN artifact.bucket IS 'Object storage bucket name.';
    COMMENT ON COLUMN artifact.object_key IS 'Object storage key.';
    COMMENT ON COLUMN artifact.byte_size IS 'Size of the object in bytes.';
    COMMENT ON COLUMN artifact.checksum_sha256 IS 'SHA-256 checksum of the object.';
    COMMENT ON COLUMN artifact.status IS 'Processing status indicating whether artifact has been uploaded, is pending verification, completed, or failed.';
    COMMENT ON COLUMN artifact.uploaded_at IS 'Timestamp when the object upload was verified as complete.';
    COMMENT ON COLUMN artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN artifact.revision_count IS 'Revision count used for concurrency control.';

    
    --------------------------------------------------------------------------------
    -- UPLOAD_ARCHIVE
    --------------------------------------------------------------------------------

    CREATE TABLE upload_archive (
      upload_archive_id uuid DEFAULT public.gen_random_uuid(),
      upload_id uuid NOT NULL,
      artifact_id uuid NOT NULL,
      status process_status NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT upload_archive_pk PRIMARY KEY (upload_archive_id),
      CONSTRAINT upload_archive_upload_fk FOREIGN KEY (upload_id) REFERENCES upload(upload_id),
      CONSTRAINT upload_archive_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id),
      CONSTRAINT upload_archive_artifact_uq UNIQUE (artifact_id)
    );

    CREATE INDEX upload_archive_upload_idx ON upload_archive(upload_id);
    CREATE INDEX upload_archive_artifact_idx ON upload_archive(artifact_id);

    COMMENT ON TABLE upload_archive IS 'Associates an upload session with the archive artifact that was uploaded. Each archive artifact can only have one upload_archive record.';
    COMMENT ON COLUMN upload_archive.upload_archive_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN upload_archive.upload_id IS 'Foreign key to the upload session.';
    COMMENT ON COLUMN upload_archive.artifact_id IS 'Foreign key to the archive artifact.';
    COMMENT ON COLUMN upload_archive.status IS 'Processing status of the archive (draft → pending → completed/failed).';
    COMMENT ON COLUMN upload_archive.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN upload_archive.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN upload_archive.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN upload_archive.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN upload_archive.revision_count IS 'Revision count used for concurrency control.';


    --------------------------------------------------------------------------------
    -- UPLOAD_ARTIFACT
    --------------------------------------------------------------------------------

    CREATE TABLE upload_artifact (
      upload_artifact_id uuid DEFAULT public.gen_random_uuid(),
      upload_id uuid NOT NULL,
      artifact_id uuid NOT NULL,
      role upload_artifact_role NOT NULL,
      upload_archive_id uuid,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT upload_artifact_pk PRIMARY KEY (upload_artifact_id),
      CONSTRAINT upload_artifact_upload_fk FOREIGN KEY (upload_id) REFERENCES upload(upload_id),
      CONSTRAINT upload_artifact_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id),
      CONSTRAINT upload_artifact_upload_archive_fk FOREIGN KEY (upload_archive_id) REFERENCES upload_archive(upload_archive_id),
      CONSTRAINT upload_artifact_uq UNIQUE (upload_id, artifact_id)
    );

    CREATE INDEX upload_artifact_upload_idx ON upload_artifact(upload_id);
    CREATE INDEX upload_artifact_artifact_idx ON upload_artifact(artifact_id);
    CREATE INDEX upload_artifact_upload_archive_idx ON upload_artifact(upload_archive_id);
    CREATE INDEX upload_artifact_role_idx ON upload_artifact(upload_id, role);

    COMMENT ON TABLE upload_artifact IS 'Join table associating upload sessions to the artifacts they produced. For archive uploads, upload_archive_id is populated with the archive metadata. For direct uploads, upload_archive_id is NULL.';
    COMMENT ON COLUMN upload_artifact.upload_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN upload_artifact.upload_id IS 'Foreign key to the upload session.';
    COMMENT ON COLUMN upload_artifact.artifact_id IS 'Foreign key to the produced artifact.';
    COMMENT ON COLUMN upload_artifact.upload_archive_id IS 'Foreign key to the upload_archive record if this artifact was extracted from an archive. NULL for direct uploads.';
    COMMENT ON COLUMN upload_artifact.role IS 'The role of artifact in the submission, such as feature, attachment, metadata, etc.';
    COMMENT ON COLUMN upload_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN upload_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN upload_artifact.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN upload_artifact.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN upload_artifact.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- ARTIFACT_SECURITY
    --------------------------------------------------------------------------------

    CREATE TABLE artifact_security (
      artifact_security_id uuid DEFAULT public.gen_random_uuid(),
      artifact_id uuid NOT NULL,
      security security_status,
      record_end_date timestamptz(6),
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT artifact_security_pk PRIMARY KEY (artifact_security_id),
      CONSTRAINT artifact_security_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifact(artifact_id)
    );

    -- An artifact can only have one active security status
    CREATE UNIQUE INDEX artifact_security_security_uk ON artifact_security (artifact_id, security) WHERE record_end_date IS NULL;

    CREATE INDEX artifact_security_security_idx ON artifact_security(security);
    CREATE INDEX artifact_security_artifact_idx ON artifact_security(artifact_id);

    COMMENT ON TABLE artifact_security IS 'Stores the final security/security result for an artifact. One security record per artifact. Contains the most recent security security after scanning. For archive uploads, the archive itself is scanned, and all extracted files reference the same scan. security values: pending (not scanned), clean (safe), infected (malware), error (scan failed), skipped (intentionally not scanned).';
    COMMENT ON COLUMN artifact_security.artifact_security_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN artifact_security.artifact_id IS 'Foreign key to the artifact being securityd.';
    COMMENT ON COLUMN artifact_security.security IS 'Final security result of the artifact.';
    COMMENT ON COLUMN artifact_security.record_end_date IS 'Expiry date of the security status.';
    COMMENT ON COLUMN artifact_security.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN artifact_security.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN artifact_security.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN artifact_security.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN artifact_security.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- ARTIFACT_SECURITY_SCAN
    --------------------------------------------------------------------------------

    CREATE TABLE artifact_security_scan (
      artifact_security_scan_id uuid DEFAULT public.gen_random_uuid(),
      artifact_security_id uuid NOT NULL,
      status process_status NOT NULL,
      scanner_version varchar(100),
      scanned_at timestamptz,
      results jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT artifact_security_scan_pk PRIMARY KEY (artifact_security_scan_id),
      CONSTRAINT artifact_security_scan_security_fk FOREIGN KEY (artifact_security_id) REFERENCES artifact_security(artifact_security_id)
    );

    CREATE INDEX artifact_security_scan_security_idx ON artifact_security_scan(artifact_security_id);
    CREATE INDEX artifact_security_scan_status_idx ON artifact_security_scan(status);

    COMMENT ON TABLE artifact_security_scan IS 'Tracks individual malware scan events performed against a securityd artifact. Processing status tracks lifecycle of scan execution (pending → completed/failed). For archive uploads, the scan is performed on the archive, and all extracted files reference this scan via their security record.';
    COMMENT ON COLUMN artifact_security_scan.artifact_security_scan_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN artifact_security_scan.artifact_security_id IS 'Foreign key to the security record being scanned.';
    COMMENT ON COLUMN artifact_security_scan.status IS 'Processing status of the scan execution (draft → pending → completed/failed).';
    COMMENT ON COLUMN artifact_security_scan.scanner_version IS 'Version identifier of the malware scanner.';
    COMMENT ON COLUMN artifact_security_scan.scanned_at IS 'Timestamp when the scan completed.';
    COMMENT ON COLUMN artifact_security_scan.results IS 'Raw malware scan output in JSON format.';
    COMMENT ON COLUMN artifact_security_scan.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN artifact_security_scan.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN artifact_security_scan.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN artifact_security_scan.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN artifact_security_scan.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- ARTIFACT_SECURITY_SCAN_FILE
    --------------------------------------------------------------------------------

    CREATE TABLE artifact_security_scan_file (
      artifact_security_scan_file_id uuid DEFAULT public.gen_random_uuid(),
      artifact_security_scan_id uuid NOT NULL,
      file_path text NOT NULL,
      security security_status NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT artifact_security_scan_file_pk PRIMARY KEY (artifact_security_scan_file_id),
      CONSTRAINT artifact_security_scan_file_scan_fk FOREIGN KEY (artifact_security_scan_id) REFERENCES artifact_security_scan(artifact_security_scan_id)
    );

    CREATE INDEX artifact_security_scan_file_scan_idx ON artifact_security_scan_file(artifact_security_scan_id);
    CREATE INDEX artifact_security_scan_file_result_idx ON artifact_security_scan_file(security);

    COMMENT ON TABLE artifact_security_scan_file IS 'Stores per-file malware scan results for a scanned artifact. For archive uploads, contains results for all files within the archive.';
    COMMENT ON COLUMN artifact_security_scan_file.artifact_security_scan_file_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN artifact_security_scan_file.artifact_security_scan_id IS 'Foreign key to the malware scan event.';
    COMMENT ON COLUMN artifact_security_scan_file.file_path IS 'Path of the file within the artifact.';
    COMMENT ON COLUMN artifact_security_scan_file.security IS 'Security result of the malware scan for this file (pending, clean, infected, error, skipped).';
    COMMENT ON COLUMN artifact_security_scan_file.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN artifact_security_scan_file.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN artifact_security_scan_file.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN artifact_security_scan_file.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN artifact_security_scan_file.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- SUBMISSION_UPLOAD
    --------------------------------------------------------------------------------

    CREATE TABLE submission_upload (
      submission_upload_id uuid DEFAULT public.gen_random_uuid(),
      submission_id integer NOT NULL,
      upload_id uuid NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_pk PRIMARY KEY (submission_upload_id),
      CONSTRAINT submission_upload_submission_fk FOREIGN KEY (submission_id) REFERENCES submission(submission_id),
      CONSTRAINT submission_upload_upload_fk FOREIGN KEY (upload_id) REFERENCES upload(upload_id),
      CONSTRAINT submission_upload_uq UNIQUE (submission_id, upload_id)
    );

    CREATE INDEX submission_upload_submission_idx ON submission_upload(submission_id);
    CREATE INDEX submission_upload_upload_idx ON submission_upload(upload_id);

    COMMENT ON TABLE submission_upload IS 'Associates submissions with the uploads they reference.';
    COMMENT ON COLUMN submission_upload.submission_upload_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload.submission_id IS 'Foreign key to the submission record.';
    COMMENT ON COLUMN submission_upload.upload_id IS 'Foreign key to the associated upload.';
    COMMENT ON COLUMN submission_upload.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload.update_date IS 'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_upload.update_user IS 'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_upload.revision_count IS 'Revision count used for concurrency control.';

    --------------------------------------------------------------------------------
    -- AUDIT / JOURNAL TRIGGERS
    --------------------------------------------------------------------------------

    CREATE TRIGGER audit_upload BEFORE INSERT OR UPDATE OR DELETE ON upload FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_upload AFTER INSERT OR UPDATE OR DELETE ON upload FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_artifact BEFORE INSERT OR UPDATE OR DELETE ON artifact FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_artifact AFTER INSERT OR UPDATE OR DELETE ON artifact FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_upload_archive BEFORE INSERT OR UPDATE OR DELETE ON upload_archive FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_upload_archive AFTER INSERT OR UPDATE OR DELETE ON upload_archive FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_upload_artifact BEFORE INSERT OR UPDATE OR DELETE ON upload_artifact FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_upload_artifact AFTER INSERT OR UPDATE OR DELETE ON upload_artifact FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_artifact_security BEFORE INSERT OR UPDATE OR DELETE ON artifact_security FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_artifact_security AFTER INSERT OR UPDATE OR DELETE ON artifact_security FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_artifact_security_scan BEFORE INSERT OR UPDATE OR DELETE ON artifact_security_scan FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_artifact_security_scan AFTER INSERT OR UPDATE OR DELETE ON artifact_security_scan FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_artifact_security_scan_file BEFORE INSERT OR UPDATE OR DELETE ON artifact_security_scan_file FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_artifact_security_scan_file AFTER INSERT OR UPDATE OR DELETE ON artifact_security_scan_file FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    CREATE TRIGGER audit_submission_upload BEFORE INSERT OR UPDATE OR DELETE ON submission_upload FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload AFTER INSERT OR UPDATE OR DELETE ON submission_upload FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS journal_submission_upload ON submission_upload;
    DROP TRIGGER IF EXISTS audit_submission_upload ON submission_upload;
    DROP TRIGGER IF EXISTS journal_artifact_security_scan_file ON artifact_security_scan_file;
    DROP TRIGGER IF EXISTS audit_artifact_security_scan_file ON artifact_security_scan_file;
    DROP TRIGGER IF EXISTS journal_artifact_security_scan ON artifact_security_scan;
    DROP TRIGGER IF EXISTS audit_artifact_security_scan ON artifact_security_scan;
    DROP TRIGGER IF EXISTS journal_artifact_security ON artifact_security;
    DROP TRIGGER IF EXISTS audit_artifact_security ON artifact_security;
    DROP TRIGGER IF EXISTS journal_upload_artifact ON upload_artifact;
    DROP TRIGGER IF EXISTS audit_upload_artifact ON upload_artifact;
    DROP TRIGGER IF EXISTS journal_upload_archive ON upload_archive;
    DROP TRIGGER IF EXISTS audit_upload_archive ON upload_archive;
    DROP TRIGGER IF EXISTS journal_artifact ON artifact;
    DROP TRIGGER IF EXISTS audit_artifact ON artifact;
    DROP TRIGGER IF EXISTS journal_upload ON upload;
    DROP TRIGGER IF EXISTS audit_upload ON upload;

    DROP TABLE IF EXISTS submission_upload;
    DROP TABLE IF EXISTS artifact_security_scan_file;
    DROP TABLE IF EXISTS artifact_security_scan;
    DROP TABLE IF EXISTS artifact_security;
    DROP TABLE IF EXISTS upload_artifact;
    DROP TABLE IF EXISTS upload_archive;
    DROP TABLE IF EXISTS artifact;
    DROP TABLE IF EXISTS upload;

    DROP TYPE IF EXISTS upload_artifact_role;
    DROP TYPE IF EXISTS security_status;
    DROP TYPE IF EXISTS process_status;
    DROP TYPE IF EXISTS upload_status;
  `);
}
