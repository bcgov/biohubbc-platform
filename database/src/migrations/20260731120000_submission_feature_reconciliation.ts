import type { Knex } from 'knex';

/**
 * Make submission_feature the authoritative representation of every uploaded feature.
 *
 * Reconciliation classifies an incoming row against the current published row with
 * the same (submission_id, source_id). Replacement history is a direct forward link.
 *
 * 1) add reconciliation and succession columns to existing feature/upload tables
 * 2) document the new reconciliation and succession fields
 * 3) backfill linear upload history and direct feature successor history
 * 4) add lookup indexes and current-state uniqueness constraints
 * 5) extend the submission upload processing lifecycle
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Add reconciliation and succession columns to existing tables
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature ADD COLUMN content_hash varchar(64);
    ALTER TABLE submission_feature ADD COLUMN universal_id varchar(200);

    CREATE TYPE submission_feature_reconciliation_type AS ENUM (
      'new',
      'modified',
      'unmodified'
    );

    ALTER TABLE submission_feature
      ADD COLUMN reconciliation submission_feature_reconciliation_type,
      ADD COLUMN successor_submission_feature_id integer;

    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_fk5
      FOREIGN KEY (successor_submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    ALTER TABLE submission_upload
      ADD COLUMN successor_submission_upload_id uuid,
      ADD CONSTRAINT submission_upload_fk7
        FOREIGN KEY (successor_submission_upload_id)
        REFERENCES submission_upload(submission_upload_id);

    --------------------------------------------------------------------------------
    -- 2) Document reconciliation and succession fields
    --------------------------------------------------------------------------------
    COMMENT ON COLUMN submission_feature.content_hash IS
      'Deterministic SHA-256 digest of normalized submitted feature content. Used only to classify modified and unmodified uploads.';
    COMMENT ON COLUMN submission_feature.universal_id IS
      'Optional source-system correlation identifier. It is not part of feature identity.';
    COMMENT ON COLUMN submission_feature.reconciliation IS
      'How this uploaded feature compared with the current published feature having the same submission_id and source_id.';
    COMMENT ON COLUMN submission_feature.successor_submission_feature_id IS
      'Direct replacement of this historical feature. NULL for a feature with no published successor.';
    COMMENT ON COLUMN submission_upload.successor_submission_upload_id IS
      'The newer upload that made this upload stale. NULL when the upload has not been superseded.';

    --------------------------------------------------------------------------------
    -- 3) Backfill linear upload history and direct feature successor history
    --    Uploads are an append-only chain ordered by creation. Failed and deleted
    --    uploads remain in the chain because submission processing only moves forward.
    --------------------------------------------------------------------------------
    WITH ordered_uploads AS (
      SELECT
        submission_upload_id,
        LEAD(submission_upload_id) OVER (
          PARTITION BY submission_id
          ORDER BY create_date, submission_upload_id
        ) AS successor_submission_upload_id
      FROM submission_upload
    )
    UPDATE submission_upload upload
    SET successor_submission_upload_id = ordered.successor_submission_upload_id
    FROM ordered_uploads ordered
    WHERE upload.submission_upload_id = ordered.submission_upload_id
      AND ordered.successor_submission_upload_id IS NOT NULL;

    -- Legacy duplicate current features are similarly linearized. The newest
    -- occurrence remains current; every earlier occurrence is ended and linked
    -- directly to the next occurrence in publication order.
    WITH ordered AS (
      SELECT
        submission_feature_id,
        LEAD(submission_feature_id) OVER (
          PARTITION BY submission_id, source_id
          ORDER BY record_effective_date, submission_feature_id
        ) AS successor_submission_feature_id
      FROM submission_feature
      WHERE record_effective_date IS NOT NULL
        AND record_end_date IS NULL
        AND source_id IS NOT NULL
    )
    UPDATE submission_feature feature
    SET
      successor_submission_feature_id = ordered.successor_submission_feature_id,
      record_end_date = CASE
        WHEN ordered.successor_submission_feature_id IS NOT NULL THEN now()
        ELSE feature.record_end_date
      END
    FROM ordered
    WHERE feature.submission_feature_id = ordered.submission_feature_id
      AND ordered.successor_submission_feature_id IS NOT NULL;

    --------------------------------------------------------------------------------
    -- 4) Add lookup indexes and current-state uniqueness constraints
    --------------------------------------------------------------------------------
    CREATE INDEX submission_feature_idx7
      ON submission_feature (submission_id, source_id)
      WHERE source_id IS NOT NULL;

    CREATE INDEX submission_feature_idx8
      ON submission_feature (successor_submission_feature_id)
      WHERE successor_submission_feature_id IS NOT NULL;

    CREATE UNIQUE INDEX submission_upload_successor_uk
      ON submission_upload (successor_submission_upload_id)
      WHERE successor_submission_upload_id IS NOT NULL;

    CREATE UNIQUE INDEX submission_feature_current_source_uk
      ON submission_feature (submission_id, source_id)
      WHERE record_effective_date IS NOT NULL
        AND record_end_date IS NULL
        AND successor_submission_feature_id IS NULL
        AND source_id IS NOT NULL;

    COMMENT ON INDEX submission_feature_current_source_uk IS
      'At most one published current feature per submission and source identifier.';

    --------------------------------------------------------------------------------
    -- 5) Extend the submission upload processing lifecycle
    --------------------------------------------------------------------------------
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'reconciling' AFTER 'ingested';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'reconciled' AFTER 'reconciling';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Drop reconciliation and succession indexes
    --------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_current_source_uk;
    DROP INDEX IF EXISTS submission_upload_successor_uk;
    DROP INDEX IF EXISTS submission_feature_idx8;
    DROP INDEX IF EXISTS submission_feature_idx7;

    --------------------------------------------------------------------------------
    -- 2) Remove succession relationships
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature DROP CONSTRAINT IF EXISTS submission_feature_fk5;
    ALTER TABLE submission_upload DROP CONSTRAINT IF EXISTS submission_upload_fk7;
    ALTER TABLE submission_upload DROP COLUMN IF EXISTS successor_submission_upload_id;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS successor_submission_feature_id;

    --------------------------------------------------------------------------------
    -- 3) Remove reconciliation metadata
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS reconciliation;
    DROP TYPE IF EXISTS submission_feature_reconciliation_type;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS universal_id;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS content_hash;

    --------------------------------------------------------------------------------
    -- 4) Retain submission upload lifecycle enum values
    --    PostgreSQL enum values cannot be removed without replacing the enum type.
    --    Leaving the now-unused values is safe and preserves rollback compatibility.
    --------------------------------------------------------------------------------
  `);
}
