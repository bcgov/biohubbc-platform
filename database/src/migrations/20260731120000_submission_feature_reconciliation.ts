import type { Knex } from 'knex';

/**
 * Adds support for reconciling repeated uploads under the same submission by `source_id`.
 *
 * - Adds `submission_feature.content_hash`: a deterministic hash of the normalized submitted
 *   feature content, used to classify re-submitted features as unchanged vs superseded.
 * - Adds `submission_feature.universal_id`: optional cross-submission/external correlation
 *   metadata. Not used for reconciliation and not unique.
 * - Enforces at most one reconciliation-managed published row per
 *   `(submission_id, feature_type_id, source_id)` via a partial unique index. Pending
 *   (unreviewed) rows deliberately remain outside the index predicate: they coexist with
 *   the published row for the same key until approval.
 * - Adds retained upload-scoped features with inline reconciliation metadata.
 * - Backfills a retained upload-scoped feature row for each existing `submission_feature`
 *   and links produced `submission_feature` versions back to their retained upload feature.
 * - Adds a fixed reconciliation enum and normalized durable upload reconciliation counts.
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
      'Deterministic SHA-256 hex digest of the normalized submitted feature content (type, parent source id, sorted content references, normalized properties). Used to classify re-submitted features as unchanged vs superseded. NULL for rows ingested before reconciliation support; a NULL hash always compares as changed.';
    COMMENT ON COLUMN submission_feature.universal_id IS
      'Optional correlation identity supplied by the source system for cross-submission or external grouping, search, or provenance. Not used for upload reconciliation and not unique.';
    --------------------------------------------------------------------------------
    -- 2) At most one reconciliation-managed PUBLISHED row per reconciliation key.
    --    Legacy rows keep a NULL content_hash because their exact normalized submitted
    --    content cannot be reconstructed here; they are therefore outside this
    --    constraint and are superseded normally when a changed upload is approved.
    --    Pending rows (record_effective_date IS NULL) are excluded: they legitimately
    --    coexist with the published row for the same key while awaiting review.
    --------------------------------------------------------------------------------
    CREATE UNIQUE INDEX submission_feature_active_key_uk
      ON submission_feature (submission_id, feature_type_id, source_id)
      WHERE record_end_date IS NULL
        AND record_effective_date IS NOT NULL
        AND source_id IS NOT NULL
        AND content_hash IS NOT NULL;

    COMMENT ON INDEX submission_feature_active_key_uk IS
      'Enforces at most one reconciliation-managed published (active) submission_feature row per (submission_id, feature_type_id, source_id) reconciliation key.';

    CREATE UNIQUE INDEX submission_feature_pending_upload_key_uk
      ON submission_feature (submission_upload_id, feature_type_id, source_id)
      WHERE record_end_date IS NULL
        AND record_effective_date IS NULL
        AND source_id IS NOT NULL;

    COMMENT ON INDEX submission_feature_pending_upload_key_uk IS
      'Makes promotion idempotent by allowing at most one pending feature per upload reconciliation key.';

    --------------------------------------------------------------------------------
    -- 3) Helper index for submission-scoped source_id resolution and reconciliation
    --    classification joins.
    --------------------------------------------------------------------------------
    CREATE INDEX submission_feature_idx7
      ON submission_feature (submission_id, source_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx7 IS
      'Partial index for resolving live submission-scoped submission_feature source_id references.';

    --------------------------------------------------------------------------------
    -- 4) SUBMISSION FEATURE RECONCILIATION TYPE
    --    Fixed classifications produced by upload reconciliation:
    --      new:        no active feature existed for the key; a pending feature is prepared.
    --      unchanged:  an active feature existed with identical content; no pending row is needed.
    --      superseded: an active feature existed with different content; a pending replacement
    --                  is prepared without ending the active baseline before approval.
    --      conflict:   the incoming feature could not be safely reconciled or promoted.
    --------------------------------------------------------------------------------
    CREATE TYPE submission_feature_reconciliation_type AS ENUM (
      'new',
      'unchanged',
      'superseded',
      'conflict'
    );

    COMMENT ON TYPE submission_feature_reconciliation_type IS
      'Classification of an uploaded feature relative to the active submission state.';

    --------------------------------------------------------------------------------
    -- 5) SUBMISSION_UPLOAD_FEATURE
    --    Retained parsed features belonging to an immutable upload. Submitted content
    --    remains unchanged while reconciliation and metadata record derived processing.
    --------------------------------------------------------------------------------
    CREATE TABLE submission_upload_feature (
      submission_upload_feature_id uuid DEFAULT public.gen_random_uuid(),
      submission_upload_id uuid NOT NULL,
      source_id varchar(200),
      feature_type_id integer NOT NULL,
      data jsonb NOT NULL,
      data_byte_size bigint NOT NULL,
      content_hash varchar(64) NOT NULL,
      universal_id varchar(200),
      reconciliation submission_feature_reconciliation_type,
      metadata jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_feature_pk PRIMARY KEY (submission_upload_feature_id),
      CONSTRAINT submission_upload_feature_fk1
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_feature_fk2
        FOREIGN KEY (feature_type_id) REFERENCES feature_type(feature_type_id)
    );

    CREATE INDEX submission_upload_feature_idx1
      ON submission_upload_feature (submission_upload_id);
    CREATE INDEX submission_upload_feature_idx2
      ON submission_upload_feature (submission_upload_id, feature_type_id, source_id);

    COMMENT ON TABLE submission_upload_feature IS
      'Retained raw features for an immutable upload. Reconciliation patches derived fields in place and promotion creates pending rows only for new and superseded outcomes.';
    COMMENT ON COLUMN submission_upload_feature.reconciliation IS
      'Prepared new, unchanged, superseded, or conflict classification.';
    COMMENT ON COLUMN submission_upload_feature.metadata IS
      'Optional structured metadata associated with reconciliation and processing.';
    COMMENT ON COLUMN submission_upload_feature.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload_feature.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload_feature.update_date IS
      'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_upload_feature.update_user IS
      'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_upload_feature.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_upload_feature
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload_feature
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_feature
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 6) SUBMISSION_FEATURE UPLOAD PROVENANCE
    --    Link each produced feature version back to the retained upload feature that
    --    supplied its immutable submitted content.
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature ADD COLUMN submission_upload_feature_id uuid;
    ALTER TABLE submission_feature ADD CONSTRAINT submission_feature_fk5
      FOREIGN KEY (submission_upload_feature_id) REFERENCES submission_upload_feature(submission_upload_feature_id);

    CREATE INDEX submission_feature_idx8
      ON submission_feature (submission_upload_feature_id)
      WHERE submission_upload_feature_id IS NOT NULL;

    COMMENT ON COLUMN submission_feature.submission_upload_feature_id IS
      'Nullable foreign key to the retained upload feature row that produced this submission feature version. NULL only when a row predates this schema and no retained upload feature was recoverable.';

    WITH legacy_upload_features AS (
      SELECT
        public.gen_random_uuid() AS submission_upload_feature_id,
        sf.submission_feature_id,
        sf.submission_upload_id,
        sf.source_id,
        sf.feature_type_id,
        sf.data,
        COALESCE(sf.data_byte_size, octet_length(sf.data::text)::bigint, 0) AS data_byte_size,
        encode(sha256(convert_to('legacy-submission-feature:' || sf.submission_feature_id::text, 'UTF8')), 'hex') AS content_hash,
        sf.universal_id
      FROM submission_feature sf
      WHERE sf.submission_upload_feature_id IS NULL
    ),
    inserted AS (
      INSERT INTO submission_upload_feature (
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id
      )
      SELECT
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id
      FROM legacy_upload_features
      RETURNING submission_upload_feature_id
    )
    UPDATE submission_feature sf
    SET submission_upload_feature_id = legacy.submission_upload_feature_id
    FROM legacy_upload_features legacy
    JOIN inserted
      ON inserted.submission_upload_feature_id = legacy.submission_upload_feature_id
    WHERE sf.submission_feature_id = legacy.submission_feature_id;

    --------------------------------------------------------------------------------
    -- 7) SUBMISSION_UPLOAD_RECONCILIATION
    --    Durable normalized reconciliation counts for each upload.
    --------------------------------------------------------------------------------
    CREATE TABLE submission_upload_reconciliation (
      submission_upload_reconciliation_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id uuid NOT NULL,
      reconciliation submission_feature_reconciliation_type NOT NULL,
      count integer DEFAULT 0 NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_upload_reconciliation_pk PRIMARY KEY (submission_upload_reconciliation_id),
      CONSTRAINT submission_upload_reconciliation_fk1
        FOREIGN KEY (submission_upload_id) REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_upload_reconciliation_uk1 UNIQUE (submission_upload_id, reconciliation),
      CONSTRAINT submission_upload_reconciliation_ck1 CHECK (count >= 0)
    );

    COMMENT ON TABLE submission_upload_reconciliation IS
      'Prepared per-classification counts for an upload reconciliation. Exactly one row is stored for each reconciliation value, including zero counts; rows may be replaced when stale work is reconciled again and become historical facts when the upload is approved.';
    COMMENT ON COLUMN submission_upload_reconciliation.reconciliation IS
      'Feature reconciliation classification represented by this count.';
    COMMENT ON COLUMN submission_upload_reconciliation.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_upload_reconciliation.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_upload_reconciliation.update_date IS
      'The datetime the record was last updated.';
    COMMENT ON COLUMN submission_upload_reconciliation.update_user IS
      'The id of the user who last updated the record.';
    COMMENT ON COLUMN submission_upload_reconciliation.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_upload_reconciliation
      BEFORE INSERT OR UPDATE OR DELETE ON submission_upload_reconciliation
      FOR EACH ROW EXECUTE PROCEDURE tr_audit_trigger();
    CREATE TRIGGER journal_submission_upload_reconciliation
      AFTER INSERT OR UPDATE OR DELETE ON submission_upload_reconciliation
      FOR EACH ROW EXECUTE PROCEDURE tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 8) SUBMISSION UPLOAD JOB STATUSES
    --    Explicit durable lifecycle boundaries for reconciliation and promotion.
    --------------------------------------------------------------------------------
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'reconciling' AFTER 'ingested';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'reconciled' AFTER 'reconciling';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'promoting' AFTER 'reconciled';
    ALTER TYPE submission_upload_job_status ADD VALUE IF NOT EXISTS 'promoted' AFTER 'promoting';
  `);
}

/**
 * Reverts the reconciliation schema changes.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS journal_submission_upload_reconciliation ON submission_upload_reconciliation;
    DROP TRIGGER IF EXISTS audit_submission_upload_reconciliation ON submission_upload_reconciliation;
    DROP TABLE IF EXISTS submission_upload_reconciliation;
    ALTER TABLE submission_feature DROP CONSTRAINT IF EXISTS submission_feature_fk5;
    DROP INDEX IF EXISTS submission_feature_idx8;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS submission_upload_feature_id;
    DROP TRIGGER IF EXISTS journal_submission_upload_feature ON submission_upload_feature;
    DROP TRIGGER IF EXISTS audit_submission_upload_feature ON submission_upload_feature;
    DROP TABLE IF EXISTS submission_upload_feature;
    DROP TYPE IF EXISTS submission_feature_reconciliation_type;

    DROP INDEX IF EXISTS submission_feature_idx7;
    DROP INDEX IF EXISTS submission_feature_pending_upload_key_uk;
    DROP INDEX IF EXISTS submission_feature_active_key_uk;

    ALTER TABLE submission_feature DROP COLUMN IF EXISTS universal_id;
    ALTER TABLE submission_feature DROP COLUMN IF EXISTS content_hash;
  `);
}
