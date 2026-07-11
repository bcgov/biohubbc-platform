import type { Knex } from 'knex';

/**
 * Adds support for reconciling repeated uploads under the same submission by `source_id`.
 *
 * - Adds `submission_feature.content_hash`: a deterministic hash of the canonical submitted
 *   feature content, used to classify re-submitted features as unchanged vs superseded.
 * - Adds `submission_feature.universal_id`: optional cross-submission/external correlation
 *   metadata. Not used for reconciliation and not unique.
 * - Soft-ends duplicate published rows per reconciliation key (keeping the newest), then
 *   enforces at most one published row per `(submission_id, feature_type_id, source_id)`
 *   via a partial unique index. Pending (unreviewed) rows deliberately remain outside the
 *   index predicate: they coexist with the published row for the same key until approval.
 * - Adds the durable per-upload reconciliation outcome table
 *   `submission_upload_feature_reconciliation`.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Reconciliation columns on submission_feature
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature ADD COLUMN content_hash varchar(64);
    ALTER TABLE submission_feature ADD COLUMN universal_id varchar(200);

    COMMENT ON COLUMN submission_feature.content_hash IS
      'Deterministic SHA-256 hex digest of the canonical submitted feature content (type, parent source id, sorted content references, canonicalized properties). Used to classify re-submitted features as unchanged vs superseded. NULL for rows ingested before reconciliation support; a NULL hash always compares as changed.';
    COMMENT ON COLUMN submission_feature.universal_id IS
      'Optional correlation identity supplied by the source system for cross-submission or external grouping, search, or provenance. Not used for upload reconciliation and not unique.';

    --------------------------------------------------------------------------------
    -- 2) Dedupe existing duplicate published rows per reconciliation key: keep the
    --    newest row per (submission_id, feature_type_id, source_id), soft-end the rest.
    --    Historical (already-ended) and pending rows are untouched. This is the data
    --    cleanup required before the partial unique index in step 3 can be created (it
    --    is not a value backfill); rows with a NULL source_id are left untouched and are
    --    excluded from the index. Legacy rows are not otherwise repaired here — source_id
    --    is populated at ingest for all new data.
    --------------------------------------------------------------------------------
    WITH ranked AS (
      SELECT
        submission_feature_id,
        ROW_NUMBER() OVER (
          PARTITION BY submission_id, feature_type_id, source_id
          ORDER BY record_effective_date DESC, submission_feature_id DESC
        ) AS rn
      FROM submission_feature
      WHERE record_end_date IS NULL
        AND record_effective_date IS NOT NULL
        AND source_id IS NOT NULL
    )
    UPDATE submission_feature sf
    SET record_end_date = now()
    FROM ranked r
    WHERE sf.submission_feature_id = r.submission_feature_id
      AND r.rn > 1;

    --------------------------------------------------------------------------------
    -- 3) At most one PUBLISHED row per reconciliation key. Pending rows
    --    (record_effective_date IS NULL) are excluded: they legitimately coexist with
    --    the published row for the same key while awaiting review. Publication of a
    --    replacement row must therefore soft-end its predecessor first.
    --------------------------------------------------------------------------------
    CREATE UNIQUE INDEX submission_feature_active_key_uk
      ON submission_feature (submission_id, feature_type_id, source_id)
      WHERE record_end_date IS NULL
        AND record_effective_date IS NOT NULL
        AND source_id IS NOT NULL;

    COMMENT ON INDEX submission_feature_active_key_uk IS
      'Enforces at most one published (active) submission_feature row per (submission_id, feature_type_id, source_id) reconciliation key.';

    --------------------------------------------------------------------------------
    -- 4) Helper index for submission-scoped source_id resolution and reconciliation
    --    classification joins.
    --------------------------------------------------------------------------------
    CREATE INDEX submission_feature_idx7
      ON submission_feature (submission_id, source_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx7 IS
      'Partial index for resolving live submission-scoped submission_feature source_id references.';

    --------------------------------------------------------------------------------
    -- 5) Durable per-upload reconciliation outcomes.
    --    Outcomes describe how each incoming feature changed the submission state:
    --      new:        no published feature existed for the key; the incoming row was published.
    --      unchanged:  a published feature existed with identical content; it remains published.
    --      superseded: a published feature existed with different content; it was soft-ended
    --                  and the incoming row was published in its place.
    --      conflict:   the incoming feature could not be safely reconciled; it was not published.
    --------------------------------------------------------------------------------
    CREATE TYPE submission_feature_reconciliation_outcome AS ENUM (
      'new',
      'unchanged',
      'superseded',
      'conflict'
    );

    CREATE TABLE submission_upload_feature_reconciliation (
      submission_upload_feature_reconciliation_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      source_id varchar(200),
      outcome submission_feature_reconciliation_outcome NOT NULL,
      submission_feature_id integer,
      previous_submission_feature_id integer,
      details jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_feature_reconciliation_pk PRIMARY KEY (submission_upload_feature_reconciliation_id),
      CONSTRAINT submission_upload_feature_reconciliation_fk1
        FOREIGN KEY (submission_upload_id)
        REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_feature_reconciliation_fk2
        FOREIGN KEY (feature_type_id)
        REFERENCES feature_type(feature_type_id),
      CONSTRAINT submission_upload_feature_reconciliation_fk3
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_upload_feature_reconciliation_fk4
        FOREIGN KEY (previous_submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_upload_feature_reconciliation_uk1
        UNIQUE (submission_upload_id, feature_type_id, source_id)
    );

    CREATE INDEX submission_upload_feature_reconciliation_idx1
      ON submission_upload_feature_reconciliation (submission_upload_id);
    CREATE INDEX submission_upload_feature_reconciliation_idx2
      ON submission_upload_feature_reconciliation (submission_feature_id);
    CREATE INDEX submission_upload_feature_reconciliation_idx3
      ON submission_upload_feature_reconciliation (previous_submission_feature_id);

    COMMENT ON TABLE submission_upload_feature_reconciliation IS
      'Per-feature reconciliation outcomes recorded when a submission upload is activated (approved). Describes how the upload changed the current submission state.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.submission_upload_feature_reconciliation_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.submission_upload_id IS
      'Foreign key to the submission_upload table.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.feature_type_id IS
      'Foreign key to the feature_type table.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.source_id IS
      'The source-system identifier of the reconciled feature. NULL only for conflict outcomes involving rows without a source id.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.outcome IS
      'Reconciliation outcome for the feature: new, unchanged, superseded, or conflict.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.submission_feature_id IS
      'The submission_feature row that is published for the key after reconciliation. NULL for conflict outcomes.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.previous_submission_feature_id IS
      'The superseded predecessor submission_feature row. Populated for superseded outcomes only.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.details IS
      'Optional structured context for the outcome (e.g. conflict reason).';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.update_user IS
      'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_upload_feature_reconciliation.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_upload_feature_reconciliation
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_feature_reconciliation
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload_feature_reconciliation
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_feature_reconciliation
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();
  `);
}

/**
 * Reverts the reconciliation schema changes.
 *
 * Note: the soft-ends applied by the dedupe step (up step 2) are intentionally not
 * reverted — they are a safe-lossy data correction that remains valid under the
 * pre-migration schema.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_upload_feature_reconciliation ON submission_upload_feature_reconciliation;
    DROP TRIGGER IF EXISTS audit_submission_upload_feature_reconciliation ON submission_upload_feature_reconciliation;
    DROP TABLE IF EXISTS submission_upload_feature_reconciliation;
    DROP TYPE IF EXISTS submission_feature_reconciliation_outcome;

    DROP INDEX IF EXISTS submission_feature_idx7;
    DROP INDEX IF EXISTS submission_feature_active_key_uk;

    ALTER TABLE submission_feature DROP COLUMN IF EXISTS universal_id;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS content_hash;
  `);
}
