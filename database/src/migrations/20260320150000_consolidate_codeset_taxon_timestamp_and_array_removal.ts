import { Knex } from 'knex';

/**
 * Consolidated migration for:
 * 1) add submission_upload.status for ingestion lifecycle
 * 2) add upload_artifact.path for archive-relative artifact lookup
 * 3) taxon feature property type
 * 4) upload_artifact role = codeset
 * 5) submission.record_end_date defaults to active records (NULL)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Add submission_upload.status for ingestion job lifecycle
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status AS ENUM (
      'pending',
      'in_progress',
      'succeeded',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ADD COLUMN IF NOT EXISTS status submission_upload_job_status NOT NULL DEFAULT 'pending';

    CREATE INDEX IF NOT EXISTS submission_upload_status_idx ON submission_upload(status);

    COMMENT ON COLUMN submission_upload.status IS 'Background ingestion job lifecycle status for this upload attempt (pending, in_progress, succeeded, invalid, failed).';

    --------------------------------------------------------------------------------
    -- 2) Add upload_artifact.path for archive-extracted media tracking
    --------------------------------------------------------------------------------
    ALTER TABLE upload_artifact
      ADD COLUMN IF NOT EXISTS path text;

    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_archive_path_chk;

    ALTER TABLE upload_artifact
      ADD CONSTRAINT upload_artifact_archive_path_chk
      CHECK (
        (upload_archive_id IS NULL AND path IS NULL)
        OR (upload_archive_id IS NOT NULL AND path IS NOT NULL)
      );

    CREATE INDEX IF NOT EXISTS upload_artifact_path_idx
      ON upload_artifact(path);

    CREATE UNIQUE INDEX IF NOT EXISTS upload_artifact_upload_path_uq
      ON upload_artifact(upload_id, path)
      WHERE path IS NOT NULL;

    COMMENT ON COLUMN upload_artifact.path IS 'Normalized archive-relative path for extracted archive files. NULL for non-archive artifacts.';

    --------------------------------------------------------------------------------
    -- 3) Ensure feature_property_type = taxon exists
    --------------------------------------------------------------------------------
    INSERT INTO feature_property_type (name, description)
    SELECT 'taxon', 'A taxon reference type'
    WHERE NOT EXISTS (
      SELECT 1
      FROM feature_property_type
      WHERE name = 'taxon'
        AND record_end_date IS NULL
    );

    --------------------------------------------------------------------------------
    -- 4) Ensure upload_artifact_role supports codeset
    --------------------------------------------------------------------------------
    ALTER TYPE upload_artifact_role ADD VALUE IF NOT EXISTS 'codeset';

    --------------------------------------------------------------------------------
    -- 5) Ensure submissions are active by default
    --------------------------------------------------------------------------------
    ALTER TABLE submission
      ALTER COLUMN record_end_date DROP DEFAULT;

    ALTER TABLE submission
      ALTER COLUMN record_end_date DROP NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Remove feature_property_type = taxon when safe
    --------------------------------------------------------------------------------
    DELETE FROM feature_property_type
    WHERE name = 'taxon'
      AND record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );

    --------------------------------------------------------------------------------
    -- 2) Remove upload_artifact_role value = codeset
    --------------------------------------------------------------------------------

    ALTER TYPE upload_artifact_role RENAME TO upload_artifact_role_old;

    CREATE TYPE upload_artifact_role AS ENUM (
      'feature',
      'attachment'
    );

    ALTER TABLE upload_artifact
      ALTER COLUMN role TYPE upload_artifact_role
      USING role::text::upload_artifact_role;

    DROP TYPE upload_artifact_role_old;

    --------------------------------------------------------------------------------
    -- 3) Remove upload_artifact.path and submission_upload.status changes
    --------------------------------------------------------------------------------
    ALTER TABLE upload_artifact
      DROP CONSTRAINT IF EXISTS upload_artifact_archive_path_chk;

    DROP INDEX IF EXISTS upload_artifact_upload_path_uq;
    DROP INDEX IF EXISTS upload_artifact_path_idx;

    ALTER TABLE upload_artifact
      DROP COLUMN IF EXISTS path;

    DROP INDEX IF EXISTS submission_upload_status_idx;

    ALTER TABLE submission_upload
      DROP COLUMN IF EXISTS status;

    DROP TYPE IF EXISTS submission_upload_job_status;

    --------------------------------------------------------------------------------
    -- 4) Restore legacy submission.record_end_date defaults/constraint
    --------------------------------------------------------------------------------
    UPDATE submission
    SET record_end_date = NOW()
    WHERE record_end_date IS NULL;

    ALTER TABLE submission
      ALTER COLUMN record_end_date SET DEFAULT now();

    ALTER TABLE submission
      ALTER COLUMN record_end_date SET NOT NULL;
  `);
}
