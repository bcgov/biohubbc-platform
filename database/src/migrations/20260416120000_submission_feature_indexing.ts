import { Knex } from 'knex';

/**
 * Follow-up migration for submission feature indexing:
 * 1) remove feature_property_type=array via data-driven remap + allow_multiple=true
 * 2) split submission_feature_property_timestamp.value into date_value/time_value
 * 3) add submission_feature_artifact join table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Remove array property type in favor of allow_multiple + canonical scalar type
    --    (data-driven remap from existing typed table usage)
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_array_feature_properties (
      feature_property_id integer PRIMARY KEY,
      array_type_id integer NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tmp_array_feature_properties (feature_property_id, array_type_id)
    SELECT
      fp.feature_property_id,
      fp.feature_property_type_id
    FROM feature_property fp
    JOIN feature_property_type fpt
      ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE fpt.name = 'array'
      AND fpt.record_end_date IS NULL
      AND fp.record_end_date IS NULL;

    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM tmp_array_feature_properties ap
    WHERE ftp.feature_property_id = ap.feature_property_id;

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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
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
            AND fpt.name <> 'array'
          GROUP BY fp.feature_property_type_id
          ORDER BY COUNT(*) DESC, fp.feature_property_type_id ASC
          LIMIT 1
        ) AS candidate_type_id
    ),
    array_property_hits AS (
      SELECT ftp.feature_property_id, 'submission_feature_property_string'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_string t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_number'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_number t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_boolean'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_boolean t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_timestamp'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_timestamp t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_code'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_code t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_taxon'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_taxon t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'submission_feature_property_geometry'::text AS source_table, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_geometry t
        ON t.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id
    ),
    ranked_type_candidates AS (
      SELECT
        array_property_hits.feature_property_id,
        table_type_candidates.candidate_type_id,
        array_property_hits.hit_count,
        ROW_NUMBER() OVER (
          PARTITION BY array_property_hits.feature_property_id
          ORDER BY array_property_hits.hit_count DESC, array_property_hits.source_table ASC
        ) AS rank_order
      FROM array_property_hits
      JOIN table_type_candidates
        ON table_type_candidates.source_table = array_property_hits.source_table
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

    -- Fallback: if any array-typed feature properties remain unresolved by table-driven mapping,
    -- remap them to string to avoid leaving dangling references to the removed array type.
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
    FROM tmp_array_feature_properties ap, string_type
    WHERE fp.feature_property_id = ap.feature_property_id
      AND fp.feature_property_type_id = ap.array_type_id;

    DELETE FROM feature_property_type
    WHERE feature_property_type_id IN (
      SELECT DISTINCT array_type_id FROM tmp_array_feature_properties
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
      record_end_date timestamptz(6),
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
    CREATE UNIQUE INDEX submission_feature_artifact_idx3
      ON submission_feature_artifact (submission_feature_id, artifact_id)
      WHERE record_end_date IS NULL;

    COMMENT ON TABLE submission_feature_artifact IS 'Join table linking submission features to backing artifacts.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_artifact_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_id IS
      'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_artifact.artifact_id IS
      'Foreign key to the artifact table.';
    COMMENT ON COLUMN submission_feature_artifact.record_end_date IS
      'Date and time of soft deletion.';
    COMMENT ON COLUMN submission_feature_artifact.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_artifact.create_user IS
      'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_artifact.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_artifact.update_user IS
      'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_artifact.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();

    --------------------------------------------------------------------------------
    -- 4) Add durable submission_feature_error validation snapshot table
    --------------------------------------------------------------------------------
    CREATE TABLE submission_feature_error (
      submission_feature_error_id integer GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
      submission_upload_id uuid NOT NULL,
      submission_feature_id integer NOT NULL,
      feature_type_property_id integer,
      property_name text,
      error_code text NOT NULL,
      error_message text NOT NULL,
      raw_value jsonb,
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
        FOREIGN KEY (submission_feature_id)
        REFERENCES submission_feature(submission_feature_id),
      CONSTRAINT submission_feature_error_fk3
        FOREIGN KEY (feature_type_property_id)
        REFERENCES feature_type_property(feature_type_property_id)
    );

    CREATE INDEX submission_feature_error_idx1 ON submission_feature_error(submission_upload_id);
    CREATE INDEX submission_feature_error_idx2 ON submission_feature_error(submission_feature_id);
    CREATE INDEX submission_feature_error_idx3 ON submission_feature_error(feature_type_property_id);
    CREATE INDEX submission_feature_error_idx4
      ON submission_feature_error(submission_upload_id, submission_feature_id);
    CREATE INDEX submission_feature_error_idx5
      ON submission_feature_error(submission_upload_id, feature_type_property_id);
    CREATE INDEX submission_feature_error_idx6
      ON submission_feature_error(submission_upload_id, error_code);

    COMMENT ON TABLE submission_feature_error IS
      'Latest deep-validation feature-level error snapshot per submission upload.';
    COMMENT ON COLUMN submission_feature_error.submission_feature_error_id IS
      'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_error.submission_upload_id IS
      'Foreign key to submission_upload for upload-scoped validation snapshot queries.';
    COMMENT ON COLUMN submission_feature_error.submission_feature_id IS
      'Foreign key to submission_feature for feature-level validation attribution.';
    COMMENT ON COLUMN submission_feature_error.feature_type_property_id IS
      'Optional foreign key to feature_type_property when an error maps to a resolved property definition.';
    COMMENT ON COLUMN submission_feature_error.property_name IS
      'Optional raw property key when no feature_type_property mapping exists.';
    COMMENT ON COLUMN submission_feature_error.error_code IS
      'Machine-readable validation classifier.';
    COMMENT ON COLUMN submission_feature_error.error_message IS
      'Human-readable validation message.';
    COMMENT ON COLUMN submission_feature_error.raw_value IS
      'Optional raw invalid value payload captured during validation.';
    COMMENT ON COLUMN submission_feature_error.details IS
      'Optional structured validation metadata.';
    COMMENT ON COLUMN submission_feature_error.create_date IS
      'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_error.create_user IS
      'The id of the user who created the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_error.update_date IS
      'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_error.update_user IS
      'The id of the user who updated the record as identified in the system user table.';
    COMMENT ON COLUMN submission_feature_error.revision_count IS
      'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_error
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_error
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_error
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_error
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

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
    --------------------------------------------------------------------------------
    ALTER TABLE submission_feature_property_timestamp
      ADD COLUMN IF NOT EXISTS value timestamptz(6);

    UPDATE submission_feature_property_timestamp
    SET value = CASE
      WHEN date_value IS NOT NULL AND time_value IS NOT NULL THEN
        (date_value::text || ' ' || time_value::text)::timestamptz
      WHEN date_value IS NOT NULL THEN
        date_value::timestamptz
      ELSE
        (CURRENT_DATE::text || ' ' || time_value::text)::timestamptz
    END
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
    -- 4) Restore array type and selected previous mappings
    --------------------------------------------------------------------------------
    INSERT INTO feature_property_type (name, description)
    SELECT 'array', 'An array type'
    WHERE NOT EXISTS (
      SELECT 1
      FROM feature_property_type
      WHERE name = 'array'
        AND record_end_date IS NULL
    );

    WITH type_ids AS (
      SELECT
        MAX(CASE WHEN name = 'array' THEN feature_property_type_id END) AS array_type_id
      FROM feature_property_type
      WHERE record_end_date IS NULL
    )
    UPDATE feature_property fp
    SET feature_property_type_id = t.array_type_id
    FROM type_ids t
    WHERE fp.name IN (
      'site_select_strategy',
      'collected_data',
      'focal_species',
      'associated_species',
      'attractant',
      'indigenous_partnerships',
      'stakeholder_partnerships'
    );

    UPDATE feature_type_property ftp
    SET allow_multiple = false
    WHERE ftp.feature_property_id IN (
      SELECT feature_property_id
      FROM feature_property
      WHERE name IN (
        'site_select_strategy',
        'collected_data',
        'focal_species',
        'associated_species',
        'attractant',
        'indigenous_partnerships',
        'stakeholder_partnerships'
      )
    );
  `);
}
