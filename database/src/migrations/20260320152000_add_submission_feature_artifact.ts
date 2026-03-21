import type { Knex } from 'knex';

/**
 * Follow-up migration after SIMSBIOHUB-923 consolidated baseline:
 * 1) Drop policy condition key trigger/function (API enforces validation)
 * 2) Canonicalize feature_property_type names (datetime/spatial -> timestamp/geometry)
 * 3) Split submission_feature_property_timestamp.value into date_value/time_value
 * 4) Remove feature_property_type=array via inferred scalar remap
 * 5) Add submission_feature_artifact table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Drop legacy policy condition DB validation trigger/function
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS validate_policy_condition_key ON biohub.policy_statement_condition;
    DROP FUNCTION IF EXISTS biohub.tr_validate_policy_condition_key();

    --------------------------------------------------------------------------------
    -- 2) Canonical feature_property_type names
    --------------------------------------------------------------------------------
    UPDATE feature_property_type
    SET name = 'timestamp'
    WHERE name = 'datetime'
      AND record_end_date IS NULL;

    UPDATE feature_property_type
    SET name = 'geometry'
    WHERE name = 'spatial'
      AND record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 3) Split submission_feature_property_timestamp.value into date/time
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
      ADD CONSTRAINT submission_feature_property_timestamp_ck1
      CHECK (date_value IS NOT NULL OR time_value IS NOT NULL);

    ALTER TABLE submission_feature_property_timestamp
      DROP COLUMN IF EXISTS value;

    --------------------------------------------------------------------------------
    -- 4) Remove array property type by remapping to inferred scalar type
    --------------------------------------------------------------------------------
    CREATE TEMP TABLE tmp_array_feature_properties (
      feature_property_id integer PRIMARY KEY
    ) ON COMMIT DROP;

    INSERT INTO tmp_array_feature_properties (feature_property_id)
    SELECT fp.feature_property_id
    FROM feature_property fp
    JOIN feature_property_type fpt
      ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE fpt.name = 'array'
      AND fpt.record_end_date IS NULL;

    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM tmp_array_feature_properties ap
    WHERE ftp.feature_property_id = ap.feature_property_id;

    WITH inferred_targets AS (
      SELECT ftp.feature_property_id, 'string'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_string sfps
        ON sfps.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'number'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_number sfpn
        ON sfpn.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'boolean'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_boolean sfpb
        ON sfpb.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'timestamp'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_timestamp sfpt
        ON sfpt.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'code'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_code sfpc
        ON sfpc.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'taxon'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_taxon sfptx
        ON sfptx.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id

      UNION ALL

      SELECT ftp.feature_property_id, 'geometry'::text AS target_type_name, COUNT(*)::bigint AS hit_count
      FROM feature_type_property ftp
      JOIN tmp_array_feature_properties ap
        ON ap.feature_property_id = ftp.feature_property_id
      JOIN submission_feature_property_geometry sfpg
        ON sfpg.feature_type_property_id = ftp.feature_type_property_id
      GROUP BY ftp.feature_property_id
    ),
    ranked_targets AS (
      SELECT
        inferred_targets.feature_property_id,
        inferred_targets.target_type_name,
        inferred_targets.hit_count,
        ROW_NUMBER() OVER (
          PARTITION BY inferred_targets.feature_property_id
          ORDER BY inferred_targets.hit_count DESC, inferred_targets.target_type_name ASC
        ) AS rank_order
      FROM inferred_targets
    ),
    resolved_targets AS (
      SELECT
        ap.feature_property_id,
        COALESCE(
          (
            SELECT ranked_targets.target_type_name
            FROM ranked_targets
            WHERE ranked_targets.feature_property_id = ap.feature_property_id
              AND ranked_targets.rank_order = 1
          ),
          'string'
        ) AS target_type_name
      FROM tmp_array_feature_properties ap
    ),
    target_type_ids AS (
      SELECT
        resolved_targets.feature_property_id,
        fpt.feature_property_type_id AS target_type_id
      FROM feature_property_type fpt
      JOIN resolved_targets
        ON resolved_targets.target_type_name = fpt.name
      WHERE fpt.record_end_date IS NULL
    )
    UPDATE feature_property fp
    SET feature_property_type_id = target_type_ids.target_type_id
    FROM target_type_ids
    WHERE fp.feature_property_id = target_type_ids.feature_property_id
      AND fp.feature_property_id IN (SELECT feature_property_id FROM tmp_array_feature_properties);

    DELETE FROM feature_property_type
    WHERE name = 'array'
      AND record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );

    --------------------------------------------------------------------------------
    -- 5) Add submission_feature_artifact join table
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
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_artifact_id IS 'System generated surrogate primary key identifier.';
    COMMENT ON COLUMN submission_feature_artifact.submission_feature_id IS 'Foreign key to the submission_feature table.';
    COMMENT ON COLUMN submission_feature_artifact.artifact_id IS 'Foreign key to the artifact table.';
    COMMENT ON COLUMN submission_feature_artifact.record_end_date IS 'Date/time the record was retired.';
    COMMENT ON COLUMN submission_feature_artifact.create_date IS 'The datetime the record was created.';
    COMMENT ON COLUMN submission_feature_artifact.create_user IS 'The id of the user who created the record.';
    COMMENT ON COLUMN submission_feature_artifact.update_date IS 'The datetime the record was updated.';
    COMMENT ON COLUMN submission_feature_artifact.update_user IS 'The id of the user who updated the record.';
    COMMENT ON COLUMN submission_feature_artifact.revision_count IS 'Revision count used for concurrency control.';

    CREATE TRIGGER audit_submission_feature_artifact
      BEFORE INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_audit_trigger();

    CREATE TRIGGER journal_submission_feature_artifact
      AFTER INSERT OR UPDATE OR DELETE ON submission_feature_artifact
      FOR EACH ROW EXECUTE PROCEDURE biohub.tr_journal_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Drop submission_feature_artifact table
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS journal_submission_feature_artifact ON submission_feature_artifact;
    DROP TRIGGER IF EXISTS audit_submission_feature_artifact ON submission_feature_artifact;
    DROP TABLE IF EXISTS submission_feature_artifact;

    --------------------------------------------------------------------------------
    -- 2) Restore array type and selected previous mappings
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

    --------------------------------------------------------------------------------
    -- 3) Restore legacy feature_property_type names
    --------------------------------------------------------------------------------
    UPDATE feature_property_type
    SET name = 'datetime'
    WHERE name = 'timestamp'
      AND record_end_date IS NULL;

    UPDATE feature_property_type
    SET name = 'spatial'
    WHERE name = 'geometry'
      AND record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 4) Restore submission_feature_property_timestamp.value
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
    -- 5) Policy trigger/function restore intentionally omitted
    --------------------------------------------------------------------------------
  `);
}
