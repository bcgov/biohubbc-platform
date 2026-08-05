import type { Knex } from 'knex';

/**
 * Add the durable reconciliation target from retained upload features to submission features.
 *
 * Existing rows are backfilled in two passes:
 * - `new` and `superseded` upload features are linked through the reverse provenance already stored
 *   on the `submission_feature` row created from them.
 * - `unchanged` upload features did not create a new feature row, so they are matched once to the
 *   active feature with the same submission, feature type, source ID, and content hash.
 *
 * The column remains nullable because conflict or unresolved rows do not have a safe target. Runtime
 * reconciliation records the exact target for new uploads and does not repeat the historical lookup.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Add the nullable durable link.
    --
    -- Conflict and unresolved upload features intentionally remain unlinked, so the
    -- foreign key cannot be NOT NULL.
    --------------------------------------------------------------------------------
    ALTER TABLE submission_upload_feature
      ADD COLUMN submission_feature_id integer;

    ALTER TABLE submission_upload_feature
      ADD CONSTRAINT submission_upload_feature_fk3
      FOREIGN KEY (submission_feature_id)
      REFERENCES submission_feature(submission_feature_id);

    --------------------------------------------------------------------------------
    -- 2) Backfill promoted new and superseded rows.
    --
    -- These rows produced a submission_feature, whose submission_upload_feature_id is
    -- the authoritative reverse provenance link. DISTINCT ON is defensive against
    -- historical retry artifacts: prefer a non-ended row, then a pending replacement,
    -- then the most recently effective feature and highest identifier.
    --------------------------------------------------------------------------------
    WITH changed_matches AS (
      SELECT DISTINCT ON (staged.submission_upload_feature_id)
        staged.submission_upload_feature_id,
        feature.submission_feature_id
      FROM submission_upload_feature staged
      JOIN submission_feature feature
        ON feature.submission_upload_feature_id = staged.submission_upload_feature_id
      WHERE staged.reconciliation IN ('new', 'superseded')
      ORDER BY
        staged.submission_upload_feature_id,
        (feature.record_end_date IS NULL) DESC,
        (feature.record_effective_date IS NULL) DESC,
        feature.record_effective_date DESC NULLS LAST,
        feature.submission_feature_id DESC
    )
    UPDATE submission_upload_feature staged
    SET submission_feature_id = changed_matches.submission_feature_id
    FROM changed_matches
    WHERE staged.submission_upload_feature_id = changed_matches.submission_upload_feature_id;

    --------------------------------------------------------------------------------
    -- 3) Backfill unchanged rows.
    --
    -- An unchanged upload feature did not produce a new submission_feature, so no
    -- reverse provenance link exists. For historical data only, resolve its target
    -- from the upload's submission plus feature type, source ID, and content hash.
    -- Restrict candidates to rows active when the migration runs and choose the most
    -- recently effective row deterministically if historical duplicates exist.
    --
    -- New reconciliation runs store the selected submission_feature_id directly and
    -- do not rely on this natural-key lookup.
    --------------------------------------------------------------------------------
    WITH matched_unchanged AS (
      SELECT DISTINCT ON (staged.submission_upload_feature_id)
        staged.submission_upload_feature_id,
        feature.submission_feature_id
      FROM submission_upload_feature staged
      JOIN submission_upload upload
        ON upload.submission_upload_id = staged.submission_upload_id
      JOIN submission_feature feature
        ON feature.submission_id = upload.submission_id
       AND feature.feature_type_id = staged.feature_type_id
       AND feature.source_id = staged.source_id
       AND feature.content_hash = staged.content_hash
       AND feature.record_effective_date <= now()
       AND (feature.record_end_date IS NULL OR now() < feature.record_end_date)
      WHERE staged.reconciliation = 'unchanged'
      ORDER BY
        staged.submission_upload_feature_id,
        feature.record_effective_date DESC,
        feature.submission_feature_id DESC
    )
    UPDATE submission_upload_feature staged
    SET submission_feature_id = matched_unchanged.submission_feature_id
    FROM matched_unchanged
    WHERE staged.submission_upload_feature_id = matched_unchanged.submission_upload_feature_id;

    --------------------------------------------------------------------------------
    -- 4) Index the backfilled link for upload-scoped validation and indexing.
    --------------------------------------------------------------------------------
    CREATE INDEX submission_upload_feature_idx3
      ON submission_upload_feature (submission_feature_id)
      WHERE submission_feature_id IS NOT NULL;

    CREATE INDEX submission_upload_feature_idx4
      ON submission_upload_feature (submission_upload_id, reconciliation, submission_feature_id)
      WHERE submission_feature_id IS NOT NULL;

    COMMENT ON COLUMN submission_upload_feature.submission_feature_id IS
      'Nullable foreign key to the submission_feature row this upload feature should index. Set for unchanged rows during reconciliation and for changed rows after promotion; NULL for unresolved or conflict rows.';
  `);
}

/**
 * Remove the durable reconciliation target from retained upload features.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_upload_feature_idx4;
    DROP INDEX IF EXISTS submission_upload_feature_idx3;

    ALTER TABLE submission_upload_feature
      DROP CONSTRAINT IF EXISTS submission_upload_feature_fk3;

    ALTER TABLE submission_upload_feature
      DROP COLUMN IF EXISTS submission_feature_id;
  `);
}
