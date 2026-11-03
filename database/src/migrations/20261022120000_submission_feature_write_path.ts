import { Knex } from 'knex';

const DB_USER_API = process.env.DB_USER_API;

/**
 * Reduce the per-row write cost of the submission feature pipeline.
 *
 * Every uploaded feature row is inserted once and then updated by reconciliation and approval, so each
 * index on submission_feature is maintained several times per row. This migration:
 *
 * - Drops `submission_feature_idx3`, which indexes the primary key column a second time.
 * - Drops `submission_feature_idx5_active_submission_upload`. `submission_feature_idx9` has the same
 *   `record_end_date IS NULL` predicate and the same leading `submission_upload_id` column, so it serves
 *   every query the narrower index served.
 * - Ingestion now sets `urn` in the insert itself, so the `submission_feature_urn` trigger only fires for
 *   inserts that leave `urn` unset. Its `WHEN` condition is evaluated without calling the trigger function,
 *   so bulk ingestion no longer pays a per-row `feature_type` lookup.
 * - Adds `baseline_submission_feature_id`, the feature an occurrence was classified against during
 *   reconciliation, so later steps of the same reconciliation join on it instead of re-deriving it. It has
 *   no foreign key: only the reconciliation that sets it reads it, and a self-referencing foreign key makes
 *   every `submission_feature` delete scan for referencing rows.
 * - Replaces the partial `submission_feature_idx10 (parent_submission_feature_id) WHERE record_end_date IS NULL`
 *   with a full index. The parent foreign key's delete check looks up children without that predicate, so
 *   with only the partial index every deleted feature scanned the whole table, making bulk deletes of an
 *   upload's features quadratic. The full index still serves the current-children lookups.
 * - Widens `submission_feature_idx1` from `(submission_id)` to `(submission_id, submission_feature_id)`.
 *   Scope anchor computation pages through one submission's features in `submission_feature_id` order; the
 *   wider index serves that keyset scan directly and still serves every `submission_id` lookup the
 *   narrower index served, so the table keeps the same number of indexes.
 * - Grants the API user MAINTAIN on `submission_feature` so reconciliation can `ANALYZE` it after ingestion
 *   bulk-inserts an upload. Without it the API user's `ANALYZE` is skipped with only a warning.
 * - Lowers the table fillfactor so later lifecycle updates can stay on the same page. This only applies to
 *   pages written after the change.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_feature_idx3;
    DROP INDEX IF EXISTS submission_feature_idx5_active_submission_upload;

    ALTER TABLE submission_feature ADD COLUMN baseline_submission_feature_id integer;

    COMMENT ON COLUMN submission_feature.baseline_submission_feature_id IS
      'Feature this occurrence was compared with during reconciliation. NULL when the occurrence was classified as new.';

    ALTER TABLE submission_feature SET (fillfactor = 85);

    DROP INDEX IF EXISTS submission_feature_idx10;
    CREATE INDEX submission_feature_idx10 ON submission_feature (parent_submission_feature_id);

    COMMENT ON INDEX submission_feature_idx10 IS
      'Children of a submission feature: current-children walks and the parent foreign key checks on delete.';

    DROP INDEX IF EXISTS submission_feature_idx1;
    CREATE INDEX submission_feature_idx1 ON submission_feature (submission_id, submission_feature_id);

    GRANT MAINTAIN ON submission_feature TO ${DB_USER_API};

    DROP TRIGGER IF EXISTS submission_feature_urn ON submission_feature;
    CREATE TRIGGER submission_feature_urn BEFORE INSERT ON submission_feature
      FOR EACH ROW WHEN (NEW.urn IS NULL) EXECUTE PROCEDURE tr_submission_feature_urn();
  `);
}

/**
 * Restore the dropped and replaced indexes, revoke the grant, and remove the added column.
 *
 * @param {Knex} knex
 * @return {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS submission_feature_urn ON submission_feature;
    CREATE TRIGGER submission_feature_urn BEFORE INSERT ON submission_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_submission_feature_urn();

    REVOKE MAINTAIN ON submission_feature FROM ${DB_USER_API};

    DROP INDEX IF EXISTS submission_feature_idx1;
    CREATE INDEX submission_feature_idx1 ON submission_feature (submission_id);

    DROP INDEX IF EXISTS submission_feature_idx10;
    CREATE INDEX submission_feature_idx10
      ON submission_feature (parent_submission_feature_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx10 IS
      'Current children of a submission feature, for upload expression walks from evidence down to the features that reach it.';

    ALTER TABLE submission_feature RESET (fillfactor);

    ALTER TABLE submission_feature DROP COLUMN IF EXISTS baseline_submission_feature_id;

    CREATE INDEX IF NOT EXISTS submission_feature_idx5_active_submission_upload
      ON submission_feature (submission_upload_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx5_active_submission_upload IS
      'Partial index for active submission_feature rows by submission_upload_id.';

    CREATE INDEX IF NOT EXISTS submission_feature_idx3 ON submission_feature (submission_feature_id);
  `);
}
