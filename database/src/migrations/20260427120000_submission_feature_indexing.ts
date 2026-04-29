import { Knex } from 'knex';

/**
 * Follow-up migration for submission feature indexing:
 * - This branch intentionally consolidates related schema changes into one migration file.
 * - The migration is expected to run as a single transactional unit.
 *
 * 1) remove deprecated feature_property_type=array/object via data-driven remap
 * 2) split submission_feature_property_timestamp.value into date_value/time_value
 * 3) add submission_feature_artifact join table
 * 4) complete submission_upload status lifecycle enum cutover
 * 5) create upload-scoped work tables for deep property ingestion (persisted across connections)
 *
 * Operational note:
 * - Because this migration combines schema and status-cutover concerns, run during a controlled
 *   deployment window with verified backups and rollback playbook readiness.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Remove deprecated array/object property types in favor of canonical scalar types
    --    (data-driven remap from existing typed table usage). Array properties keep
    --    multiplicity by setting feature_type_property.allow_multiple=true.
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_deprecated_feature_properties (
      feature_property_id integer PRIMARY KEY,
      deprecated_type_id integer NOT NULL,
      deprecated_type_name text NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tmp_deprecated_feature_properties (
      feature_property_id,
      deprecated_type_id,
      deprecated_type_name
    )
    SELECT
      fp.feature_property_id,
      fp.feature_property_type_id,
      fpt.name
    FROM feature_property fp
    JOIN feature_property_type fpt
      ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE fpt.name IN ('array', 'object')
      AND fpt.record_end_date IS NULL
      AND fp.record_end_date IS NULL;

    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM tmp_deprecated_feature_properties dp
    WHERE ftp.feature_property_id = dp.feature_property_id
      AND dp.deprecated_type_name = 'array';

    WITH table_type_candidates AS (
      SELECT
        'submission_feature_property_string'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_string t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_number'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_number t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_boolean'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_boolean t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_timestamp'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_timestamp t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_code'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_code t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_taxon'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_taxon t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id

      UNION ALL

      SELECT
        'submission_feature_property_geometry'::text AS source_table,
        (
          SELECT fp.feature_property_type_id
          FROM submission_feature_property_geometry t
          JOIN feature_type_property ftp
            ON ftp.feature_type_property_id = t.feature_type_property_id
          JOIN feature_property fp
            ON fp.feature_property_id = ftp.feature_property_id
          JOIN feature_property_type fpt
            ON fpt.feature_property_type_id = fp.feature_property_type_id
          WHERE fp.record_end_date IS NULL
            AND fpt.record_end_date IS NULL
            AND fpt.name NOT IN ('array', 'object')
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id
    ),
    deprecated_property_hits AS (
      SELECT ftp.feature_property_id, 'submission_feature_property_string'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_string t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_number'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_number t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_boolean'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_boolean t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_timestamp'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_timestamp t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_code'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_code t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_taxon'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_taxon t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_geometry'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_deprecated_feature_properties dp
        ON dp.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_geometry t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id
    ),
    ranked_type_candidates AS (
      SELECT
        deprecated_property_hits.feature_property_id,
        table_type_candidates.candidate_type_id,
        deprecated_property_hits.hit_count,
        ROW_NUMBER() OVER (
          PARTITION BY deprecated_property_hits.feature_property_id
          ORDER BY deprecated_property_hits.hit_count DESC, deprecated_property_hits.source_table ASC
        ) AS rank_order
      FROM deprecated_property_hits
      JOIN table_type_candidates
        ON table_type_candidates.source_table = deprecated_property_hits.source_table
      WHERE table_type_candidates.candidate_type_id IS NOT NULL
    ),
    resolved_type_targets AS (
      SELECT
        ranked_type_candidates.feature_property_id,
        ranked_type_candidates.candidate_type_id AS target_type_id
      FROM ranked_type_candidates
      WHERE ranked_type_candidates.rank_order = 1
    )
    UPDATE feature_property fp
    SET feature_property_type_id = resolved_type_targets.target_type_id
    FROM resolved_type_targets
    WHERE fp.feature_property_id = resolved_type_targets.feature_property_id;

    -- Fallback: if any deprecated feature properties remain unresolved by table-driven mapping,
    -- remap them to string to avoid leaving dangling references to removed property types.
    WITH string_type AS (
      SELECT feature_property_type_id AS string_type_id
      FROM feature_property_type
      WHERE name = 'string'
        AND record_end_date IS NULL
      ORDER BY feature_property_type_id ASC
      LIMIT 1
    )
    UPDATE feature_property fp
    SET feature_property_type_id = string_type.string_type_id
    FROM tmp_deprecated_feature_properties dp, string_type
    WHERE fp.feature_property_id = dp.feature_property_id
      AND fp.feature_property_type_id = dp.deprecated_type_id;

    DELETE FROM feature_property_type
    WHERE feature_property_type_id IN (
      SELECT DISTINCT deprecated_type_id FROM tmp_deprecated_feature_properties
    )
      AND NOT EXISTS (
        SELECT 1
        FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );

    --------------------------------------------------------------------------------
    -- 2) Split submission_feature_property_timestamp.value into date/time columns
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_timestamp
      ADD COLUMN IF NOT EXISTS date_value date,
      ADD COLUMN IF NOT EXISTS time_value time;

    UPDATE submission_feature_property_timestamp
    SET
      date_value = COALESCE(date_value, value::date),
      time_value = COALESCE(time_value, value::time)
    WHERE value IS NOT NULL;

    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx3;

    CREATE INDEX IF NOT EXISTS submission_feature_property_timestamp_idx3
      ON submission_feature_property_timestamp(date_value);

    CREATE INDEX IF NOT EXISTS submission_feature_property_timestamp_idx4
      ON submission_feature_property_timestamp(time_value);

    ALTER TABLE submission_feature_property_timestamp
      DROP CONSTRAINT IF EXISTS submission_feature_property_timestamp_ck1;

    ALTER TABLE submission_feature_property_timestamp
      ADD CONSTRAINT submission_feature_property_timestamp_ck1
      CHECK (date_value IS NOT NULL OR time_value IS NOT NULL);

    COMMENT ON COLUMN submission_feature_property_timestamp.date_value IS
      'Date component for canonical datetime property values; may be null when only time is provided.';
    COMMENT ON COLUMN submission_feature_property_timestamp.time_value IS
      'Time component for canonical datetime property values; may be null when only date is provided.';

    ALTER TABLE submission_feature_property_timestamp
      DROP COLUMN IF EXISTS value;

    --------------------------------------------------------------------------------
    -- 3) Add submission_feature_artifact join table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_feature_artifact (
      submission_feature_artifact_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_feature_id integer NOT NULL,
      artifact_id uuid NOT NULL,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_artifact_pk PRIMARY KEY (submission_feature_artifact_id),
      CONSTRAINT submission_feature_artifact_fk1
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_artifact_fk2
        FOREIGN KEY (artifact_id)
        REFERENCES artifact(artifact_id)
    );

    CREATE INDEX submission_feature_artifact_idx1 ON submission_feature_artifact(submission_feature_id);
    CREATE INDEX submission_feature_artifact_idx2 ON submission_feature_artifact(artifact_id);
    CREATE UNIQUE INDEX submission_feature_artifact_idx3 ON submission_feature_artifact (submission_feature_id, artifact_id);

    COMMENT ON TABLE submission_feature_artifact IS 'Join table linking submission features to backing artifacts.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_artifact_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_id IS
      'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_artifact.artifact_id IS
      'Foreign key to the artifact table.';
    COMMENT ON COLUMN submission_feature_artifact.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_artifact.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_artifact.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_artifact.update_user IS
      'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_artifact.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 4) Add durable upload-scoped submission_feature_error validation summary table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_feature_error (
      submission_feature_error_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id uuid NOT NULL,
      feature_type_property_id integer,
      property_name text,
      error_code text NOT NULL,
      error_message text NOT NULL,
      count integer NOT NULL,
      details jsonb,
      create_date timestamptz(6) DEFAULT now() NOT NULL,
      create_user integer NOT NULL,
      update_date timestamptz(6),
      update_user integer,
      revision_count integer DEFAULT 0 NOT NULL,
      CONSTRAINT submission_feature_error_pk PRIMARY KEY (submission_feature_error_id),
      CONSTRAINT submission_feature_error_fk1
        FOREIGN KEY (submission_upload_id)
        REFERENCES submission_upload(submission_upload_id),
      CONSTRAINT submission_feature_error_fk2
        FOREIGN KEY (feature_type_property_id)
        REFERENCES feature_type_property(feature_type_property_id)
    );

    CREATE INDEX submission_feature_error_idx1 ON submission_feature_error(submission_upload_id);
    CREATE INDEX submission_feature_error_idx2 ON submission_feature_error(submission_upload_id, error_code);
    CREATE INDEX submission_feature_error_idx3
      ON submission_feature_error(submission_upload_id, feature_type_property_id);
    CREATE UNIQUE INDEX submission_feature_error_u1
      ON submission_feature_error (
        submission_upload_id,
        error_code,
        feature_type_property_id,
        property_name
      );

    COMMENT ON TABLE submission_feature_error IS
      'Upload-scoped aggregated validation error summary for deep property ingestion.';
    COMMENT ON COLUMN submission_feature_error.submission_feature_error_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_error.submission_upload_id IS
      'Foreign key to submission_upload for upload-scoped validation summary queries.';
    COMMENT ON COLUMN submission_feature_error.feature_type_property_id IS
      'Optional foreign key to feature_type_property when an error maps to a resolved property definition.';
    COMMENT ON COLUMN submission_feature_error.property_name IS
      'Optional raw property key when no feature_type_property mapping exists.';
    COMMENT ON COLUMN submission_feature_error.error_code IS
      'Machine-readable validation classifier used for grouping and UI rendering.';
    COMMENT ON COLUMN submission_feature_error.error_message IS
      'Human-readable summary message for the grouped validation issue.';
    COMMENT ON COLUMN submission_feature_error.count IS
      'Number of feature-level validation error instances represented by this row.';
    COMMENT ON COLUMN submission_feature_error.details IS
      'Optional structured aggregated metadata for the grouped validation issue.';
    COMMENT ON COLUMN submission_feature_error.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_error.create_user IS
      'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_error.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_error.update_user IS
      'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_error.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_error
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_error
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_error
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_error
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 5) Complete cutover to explicit submission_upload lifecycle states
    --    pending -> uploaded, in_progress -> ingesting, succeeded -> ingested
    --
    --    uploaded: file artifacts are accepted and ready for ingestion.
    --    ingesting: feature extraction and validation are in progress.
    --    ingested: feature rows and validation results are persisted.
    --    indexing: derived search/index tables are being populated.
    --    indexed: derived search/index tables are ready for use.
    --    invalid: ingestion completed with deterministic validation errors.
    --    failed: processing failed due to an operational/runtime error.
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v2 AS ENUM (
      'uploaded',
      'ingesting',
      'ingested',
      'indexing',
      'indexed',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v2
      USING (
        CASE status::text
          WHEN 'pending' THEN 'uploaded'
          WHEN 'in_progress' THEN 'ingesting'
          WHEN 'succeeded' THEN 'ingested'
          ELSE status::text
        END
      )::submission_upload_job_status_v2;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v2 RENAME TO submission_upload_job_status;

    COMMENT ON TYPE submission_upload_job_status IS
      'Submission upload lifecycle: uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'uploaded'::submission_upload_job_status;

    COMMENT ON COLUMN submission_upload.status IS
      'Submission upload lifecycle status. uploaded=accepted and ready for ingestion; ingesting=feature extraction and validation running; ingested=feature rows and validation persisted; indexing=derived indexes being populated; indexed=derived indexes ready; invalid=deterministic validation errors; failed=operational/runtime failure.';

    --------------------------------------------------------------------------------
    -- 6) Create upload-scoped staging/work tables for deep property ingestion
    --
    -- Design notes:
    -- - These tables are persisted (not temp/session-local) so multi-phase ingestion can run
    --   across connection boundaries.
    -- - They are UNLOGGED for write throughput (operational working-set tables, not canonical records).
    -- - Staging tables intentionally omit FK constraints to minimize ingest-path write amplification.
    -- - Staging tables intentionally omit synthetic primary keys because no downstream phase
    --   addresses individual staging rows by identity. Avoiding PK/sequence maintenance reduces
    --   write amplification on high-volume ingestion inserts.
    -- - Staging indexes are deliberately limited to the upload-scoped read patterns used by
    --   validation, resolution, and canonical insert phases.
    --------------------------------------------------------------------------------
    --------------------------------------------------------------------------------
    -- 6.1) Base property staging
    --      Expand raw submission_feature.data.properties JSON into one row per key/value.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_raw_property (
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx1
      ON submission_upload_staging_raw_property (submission_upload_id, feature_type_id, property_name);
    CREATE INDEX IF NOT EXISTS sfp_staging_work_idx2
      ON submission_upload_staging_raw_property (
        submission_upload_id,
        submission_feature_id,
        property_name
      );

    COMMENT ON TABLE submission_upload_staging_raw_property IS
      'UNLOGGED upload-scoped raw property staging rows extracted from submission_feature.data.properties.';
    COMMENT ON COLUMN submission_upload_staging_raw_property.submission_feature_id IS
      'Submission feature identifier owning the raw property key/value.';
    COMMENT ON COLUMN submission_upload_staging_raw_property.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_raw_property.feature_type_id IS
      'Feature type identifier for metadata resolution.';
    COMMENT ON COLUMN submission_upload_staging_raw_property.property_name IS
      'Raw property key from the feature payload.';
    COMMENT ON COLUMN submission_upload_staging_raw_property.value IS
      'Raw property value JSON payload.';

    --------------------------------------------------------------------------------
    -- 6.2) Property metadata resolution staging
    --      Join raw rows to feature metadata (feature_type_property, type, required, multiplicity).
    --      This intentionally subsumes the need for a separate feature_type_property map staging table.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_resolved_property (
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      property_name text NOT NULL,
      value jsonb NOT NULL,
      feature_type_property_id integer,
      allow_multiple boolean,
      required_value boolean,
      property_type_name text
    );

    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx1
      ON submission_upload_staging_resolved_property (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx2
      ON submission_upload_staging_resolved_property (submission_upload_id, feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx3
      ON submission_upload_staging_resolved_property (submission_upload_id, property_type_name);
    CREATE INDEX IF NOT EXISTS sf_resolved_work_idx4
      ON submission_upload_staging_resolved_property (submission_upload_id, feature_type_id, property_name);

    COMMENT ON TABLE submission_upload_staging_resolved_property IS
      'UNLOGGED upload-scoped property staging rows enriched with resolved feature metadata.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.submission_feature_id IS
      'Submission feature identifier owning the resolved property.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.feature_type_id IS
      'Feature type identifier used for metadata joins.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.property_name IS
      'Resolved property name key.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.value IS
      'Resolved raw property JSON value.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.feature_type_property_id IS
      'Resolved feature_type_property identifier when mapping exists.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.allow_multiple IS
      'Resolved property multiplicity flag.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.required_value IS
      'Resolved required property flag.';
    COMMENT ON COLUMN submission_upload_staging_resolved_property.property_type_name IS
      'Resolved logical property type name.';

    --------------------------------------------------------------------------------
    -- 6.3) Typed logical-value staging
    --      Materialize one logical value per row (including array expansion where allowed).
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_typed_property_value (
      submission_feature_id integer NOT NULL,
      submission_upload_id uuid NOT NULL,
      feature_type_id integer NOT NULL,
      feature_type_property_id integer NOT NULL,
      property_name text NOT NULL,
      property_type_name text NOT NULL,
      allow_multiple boolean NOT NULL,
      logical_value jsonb NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx1
      ON submission_upload_staging_typed_property_value (submission_upload_id, property_type_name);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx2
      ON submission_upload_staging_typed_property_value (submission_upload_id, feature_type_property_id);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx3
      ON submission_upload_staging_typed_property_value (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_property_value_work_idx4
      ON submission_upload_staging_typed_property_value (
        submission_upload_id,
        submission_feature_id,
        feature_type_property_id,
        property_name
      );

    COMMENT ON TABLE submission_upload_staging_typed_property_value IS
      'UNLOGGED upload-scoped typed logical property values (one logical value per row).';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.submission_feature_id IS
      'Submission feature identifier owning the typed logical value.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.feature_type_id IS
      'Feature type identifier for downstream checks.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.feature_type_property_id IS
      'Resolved feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.property_name IS
      'Resolved property key name.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.property_type_name IS
      'Logical property type name.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.allow_multiple IS
      'Resolved multiplicity flag copied from feature_type_property.';
    COMMENT ON COLUMN submission_upload_staging_typed_property_value.logical_value IS
      'Single logical JSON value used for validation and insertion.';

    --------------------------------------------------------------------------------
    -- 6.4) Complex-type candidate staging: datetime
    --      Store parsed date/time candidates for validation + canonical insert reuse.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_datetime_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      value_text text,
      raw_value jsonb NOT NULL,
      date_value date,
      time_value time without time zone
    );

    CREATE INDEX IF NOT EXISTS sf_datetime_candidate_work_idx1
      ON submission_upload_staging_datetime_candidate (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_datetime_candidate_work_idx2
      ON submission_upload_staging_datetime_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_datetime_candidate IS
      'UNLOGGED upload-scoped parsed datetime candidates for validation and timestamp insertion.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.submission_feature_id IS
      'Submission feature identifier owning the datetime candidate.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.property_name IS
      'Resolved datetime property key name.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.feature_type_property_id IS
      'Resolved datetime feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.value_text IS
      'Trimmed string representation extracted from raw_value.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.raw_value IS
      'Original logical datetime JSON value.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.date_value IS
      'Parsed date component when present and valid.';
    COMMENT ON COLUMN submission_upload_staging_datetime_candidate.time_value IS
      'Parsed time component when present and valid.';

    --------------------------------------------------------------------------------
    -- 6.5) Complex-type candidate staging: spatial
    --      Store normalized/parsible geometry candidates and validity metadata.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_spatial_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      logical_value jsonb NOT NULL,
      geometry_json jsonb,
      parsed_geom geometry,
      validity_reason text,
      is_valid boolean
    );

    CREATE INDEX IF NOT EXISTS sf_spatial_candidate_work_idx1
      ON submission_upload_staging_spatial_candidate (submission_upload_id, submission_feature_id);
    CREATE INDEX IF NOT EXISTS sf_spatial_candidate_work_idx2
      ON submission_upload_staging_spatial_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_spatial_candidate IS
      'UNLOGGED upload-scoped normalized spatial candidates with parse/validity metadata.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.submission_feature_id IS
      'Submission feature identifier owning the spatial candidate.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.property_name IS
      'Resolved spatial property key name.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.feature_type_property_id IS
      'Resolved spatial feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.logical_value IS
      'Original logical spatial JSON value.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.geometry_json IS
      'Normalized GeoJSON geometry payload.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.parsed_geom IS
      'Parsed PostGIS geometry value from normalized GeoJSON.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.validity_reason IS
      'PostGIS validity reason or parser failure reason.';
    COMMENT ON COLUMN submission_upload_staging_spatial_candidate.is_valid IS
      'Boolean validity result from spatial normalization checks.';

    --------------------------------------------------------------------------------
    -- 6.6) Complex-type candidate staging: code references
    --      Store parsed code slugs and resolved contributor_codeset_code_id lookups.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_code_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      is_format_valid boolean NOT NULL,
      normalized_slug text,
      contributor_codeset_code_id integer
    );

    CREATE INDEX IF NOT EXISTS sf_code_candidate_work_idx1
      ON submission_upload_staging_code_candidate (submission_upload_id, is_format_valid);
    CREATE INDEX IF NOT EXISTS sf_code_candidate_work_idx2
      ON submission_upload_staging_code_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_code_candidate IS
      'UNLOGGED upload-scoped parsed code reference candidates and resolution outputs.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.submission_feature_id IS
      'Submission feature identifier owning the code candidate.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.property_name IS
      'Resolved code property key name.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.feature_type_property_id IS
      'Resolved code feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.raw_value IS
      'Original logical code JSON value.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.is_format_valid IS
      'Format validation result for code::<codeset>::<code>.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.normalized_slug IS
      'Normalized canonical code slug representation.';
    COMMENT ON COLUMN submission_upload_staging_code_candidate.contributor_codeset_code_id IS
      'Resolved contributor_codeset_code identifier when lookup succeeds.';

    --------------------------------------------------------------------------------
    -- 6.7) Complex-type candidate staging: taxon references
    --      Store parsed TSNs and resolved taxon_id lookups.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_taxon_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      tsn integer,
      taxon_id integer
    );

    CREATE INDEX IF NOT EXISTS sf_taxon_candidate_work_idx1
      ON submission_upload_staging_taxon_candidate (submission_upload_id, taxon_id);
    CREATE INDEX IF NOT EXISTS sf_taxon_candidate_work_idx2
      ON submission_upload_staging_taxon_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_taxon_candidate IS
      'UNLOGGED upload-scoped parsed taxon TSN candidates and resolution outputs.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.submission_feature_id IS
      'Submission feature identifier owning the taxon candidate.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.property_name IS
      'Resolved taxon property key name.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.feature_type_property_id IS
      'Resolved taxon feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.raw_value IS
      'Original logical taxon JSON value.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.tsn IS
      'Parsed integer TSN candidate extracted from raw_value.';
    COMMENT ON COLUMN submission_upload_staging_taxon_candidate.taxon_id IS
      'Resolved taxon identifier when lookup succeeds.';

    --------------------------------------------------------------------------------
    -- 6.8) Complex-type candidate staging: artifact references
    --      Store normalized artifact references and resolved artifact_id lookups.
    --------------------------------------------------------------------------------
    CREATE UNLOGGED TABLE IF NOT EXISTS submission_upload_staging_artifact_candidate (
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      property_name text NOT NULL,
      feature_type_property_id integer NOT NULL,
      raw_value jsonb NOT NULL,
      normalized_reference text,
      artifact_id uuid
    );

    CREATE INDEX IF NOT EXISTS sf_artifact_candidate_work_idx1
      ON submission_upload_staging_artifact_candidate (submission_upload_id, artifact_id);
    CREATE INDEX IF NOT EXISTS sf_artifact_candidate_work_idx2
      ON submission_upload_staging_artifact_candidate (submission_upload_id, feature_type_property_id);

    COMMENT ON TABLE submission_upload_staging_artifact_candidate IS
      'UNLOGGED upload-scoped parsed artifact reference candidates and resolution outputs.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.submission_upload_id IS
      'Upload scope for staging lifecycle management.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.submission_feature_id IS
      'Submission feature identifier owning the artifact candidate.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.property_name IS
      'Resolved artifact property key name.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.feature_type_property_id IS
      'Resolved artifact feature_type_property identifier.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.raw_value IS
      'Original logical artifact reference JSON value.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.normalized_reference IS
      'Normalized artifact reference used for upload_artifact lookup.';
    COMMENT ON COLUMN submission_upload_staging_artifact_candidate.artifact_id IS
      'Resolved artifact identifier when lookup succeeds.';

    CREATE INDEX IF NOT EXISTS submission_feature_idx6
      ON submission_feature(submission_upload_id, source_id)
      WHERE record_end_date IS NULL;

    COMMENT ON INDEX submission_feature_idx6 IS
      'Partial index for resolving active upload-scoped submission_feature source_id references.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP INDEX IF EXISTS submission_feature_idx6;

    --------------------------------------------------------------------------------
    -- 1) Drop submission_feature_error table
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_submission_feature_error ON submission_feature_error;
    DROP TRIGGER IF EXISTS audit_submission_feature_error ON submission_feature_error;
    DROP TABLE IF EXISTS submission_feature_error;

    --------------------------------------------------------------------------------
    -- 2) Drop submission_feature_artifact table
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_submission_feature_artifact ON submission_feature_artifact;
    DROP TRIGGER IF EXISTS audit_submission_feature_artifact ON submission_feature_artifact;
    DROP TABLE IF EXISTS submission_feature_artifact;

    --------------------------------------------------------------------------------
    -- 3) Restore submission_feature_property_timestamp.value
    --    Guard against lossy reconstruction:
    --    rollback is only permitted when both date_value and time_value are present.
    --------------------------------------------------------------------------------
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM submission_feature_property_timestamp
        WHERE (date_value IS NULL) <> (time_value IS NULL)
      ) THEN
        RAISE EXCEPTION USING
          MESSAGE = 'Down migration blocked: lossy timestamp rollback detected',
          HINT = 'Found rows with only one component (date_value or time_value). Restore canonical timestamptz values manually before rollback.';
      END IF;
    END
    $$;

    ALTER TABLE submission_feature_property_timestamp
      ADD COLUMN IF NOT EXISTS value timestamptz(6);

    UPDATE submission_feature_property_timestamp
    SET value = (date_value::text || ' ' || time_value::text)::timestamptz
    WHERE value IS NULL;

    ALTER TABLE submission_feature_property_timestamp
      ALTER COLUMN value SET NOT NULL;

    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx4;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx3;

    CREATE INDEX submission_feature_property_timestamp_idx3
      ON submission_feature_property_timestamp(value);

    ALTER TABLE submission_feature_property_timestamp
      DROP CONSTRAINT IF EXISTS submission_feature_property_timestamp_ck1;

    ALTER TABLE submission_feature_property_timestamp
      DROP COLUMN IF EXISTS date_value,
      DROP COLUMN IF EXISTS time_value;

    --------------------------------------------------------------------------------
    -- 4) Drop upload-scoped work tables (reverse dependency order)
    --------------------------------------------------------------------------------
    DROP TABLE IF EXISTS submission_upload_staging_artifact_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_taxon_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_code_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_spatial_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_datetime_candidate;
    DROP TABLE IF EXISTS submission_upload_staging_typed_property_value;
    DROP TABLE IF EXISTS submission_upload_staging_resolved_property;
    DROP TABLE IF EXISTS submission_upload_staging_raw_property;

    --------------------------------------------------------------------------------
    -- 5) Revert submission_upload lifecycle enum cutover to legacy states
    --------------------------------------------------------------------------------
    CREATE TYPE submission_upload_job_status_v1 AS ENUM (
      'pending',
      'in_progress',
      'succeeded',
      'invalid',
      'failed'
    );

    ALTER TABLE submission_upload
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE submission_upload
      ALTER COLUMN status TYPE submission_upload_job_status_v1
      USING (
        CASE status::text
          WHEN 'uploaded' THEN 'pending'
          WHEN 'ingesting' THEN 'in_progress'
          WHEN 'ingested' THEN 'succeeded'
          WHEN 'indexing' THEN 'succeeded'
          WHEN 'indexed' THEN 'succeeded'
          ELSE status::text
        END
      )::submission_upload_job_status_v1;

    DROP TYPE submission_upload_job_status;

    ALTER TYPE submission_upload_job_status_v1 RENAME TO submission_upload_job_status;

    ALTER TABLE submission_upload
      ALTER COLUMN status SET DEFAULT 'pending'::submission_upload_job_status;

    --------------------------------------------------------------------------------
    -- 6) Deprecated property type rollback is intentionally non-automated
    --    The array/object remap in up() is data-driven and does not persist an exact reverse map.
    --    Automatic rollback is blocked to avoid non-deterministic/hardcoded restores.
    --------------------------------------------------------------------------------
    DO $$
    BEGIN
      RAISE EXCEPTION USING
        MESSAGE = 'Down migration blocked: deprecated property type remap is non-reversible without preserved mapping metadata',
        HINT = 'Restore feature_property and feature_type_property mappings from backup, then perform a controlled manual rollback.';
    END
    $$;
  `);
}
