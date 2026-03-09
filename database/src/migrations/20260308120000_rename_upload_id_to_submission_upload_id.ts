import { Knex } from 'knex';

/**
 * Rename submission_feature.upload_id → submission_upload_id and retarget FK
 * from upload(upload_id) to submission_upload(submission_upload_id).
 *
 * submission_upload_id is the processing identifier — it tracks which upload event
 * produced these features for a submission. This distinction enables multi-upload-per-submission
 * (append, replace) and eliminates the need to carry both uploadId and submissionId
 * through the pipeline.
 *
 * Backfill resolves existing upload_id values to submission_upload_id via the
 * submission_upload bridge table. A self-check assertion ensures no orphaned rows
 * remain before applying the FK constraint.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- 1. Drop existing FK and index (target: upload table)
    ALTER TABLE submission_feature
      DROP CONSTRAINT IF EXISTS submission_feature_fk4;

    DROP INDEX IF EXISTS submission_feature_idx4;

    -- 2. Backfill: resolve upload_id → submission_upload_id via bridge table
    UPDATE submission_feature sf
      SET upload_id = su.submission_upload_id
      FROM submission_upload su
      WHERE su.upload_id = sf.upload_id;

    -- 3. Self-check: fail if any rows could not be resolved
    DO $$
    DECLARE orphan_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO orphan_count
      FROM submission_feature sf
      LEFT JOIN submission_upload su ON su.submission_upload_id = sf.upload_id
      WHERE su.submission_upload_id IS NULL;

      IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Backfill incomplete: % submission_feature rows have no matching submission_upload', orphan_count;
      END IF;
    END $$;

    -- 4. Rename column
    ALTER TABLE submission_feature
      RENAME COLUMN upload_id TO submission_upload_id;

    -- 5. Add new FK (target: submission_upload table)
    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_fk4
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id);

    -- 6. Add index
    CREATE INDEX submission_feature_idx4
      ON submission_feature(submission_upload_id);

    -- 7. Update column comment
    COMMENT ON COLUMN submission_feature.submission_upload_id IS 'Foreign key to the submission_upload table.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    -- 1. Drop new FK and index
    ALTER TABLE submission_feature
      DROP CONSTRAINT IF EXISTS submission_feature_fk4;

    DROP INDEX IF EXISTS submission_feature_idx4;

    -- 2. Reverse backfill: resolve submission_upload_id → upload_id via bridge table
    UPDATE submission_feature sf
      SET submission_upload_id = su.upload_id
      FROM submission_upload su
      WHERE su.submission_upload_id = sf.submission_upload_id;

    -- 3. Rename column back
    ALTER TABLE submission_feature
      RENAME COLUMN submission_upload_id TO upload_id;

    -- 4. Restore original FK (target: upload table)
    ALTER TABLE submission_feature
      ADD CONSTRAINT submission_feature_fk4
        FOREIGN KEY (upload_id) REFERENCES upload(upload_id);

    -- 5. Restore index
    CREATE INDEX submission_feature_idx4
      ON submission_feature(upload_id);

    COMMENT ON COLUMN submission_feature.upload_id IS 'Foreign key to the upload session.';
  `);
}
