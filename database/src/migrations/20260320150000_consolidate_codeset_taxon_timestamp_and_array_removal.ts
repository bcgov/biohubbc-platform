import { Knex } from 'knex';

/**
 * Consolidated migration for:
 * 1) remove policy-statement-condition DB trigger validation (moved to API)
 * 2) taxon feature property type
 * 3) feature_property_type renames:
 *    - datetime -> timestamp
 *    - spatial -> geometry
 * 4) upload_artifact role = codeset
 * 5) submission_feature_property_timestamp value split (date_value/time_value)
 * 6) removal of feature_property_type = array
 *    - Re-map former array-typed properties to scalar types inferred from existing indexed values.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Remove policy-condition DB trigger validation (validation lives in API)
    --------------------------------------------------------------------------------
    DROP TRIGGER IF EXISTS validate_policy_condition_key ON biohub.policy_statement_condition;
    DROP FUNCTION IF EXISTS biohub.tr_validate_policy_condition_key();

    --------------------------------------------------------------------------------
    -- 2) Ensure feature_property_type = taxon exists
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
    -- 3) Rename feature_property_type values to canonical names
    --    datetime -> timestamp
    --    spatial -> geometry
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
    -- 4) Ensure upload_artifact_role supports codeset
    --------------------------------------------------------------------------------
    ALTER TYPE upload_artifact_role ADD VALUE IF NOT EXISTS 'codeset';

    --------------------------------------------------------------------------------
    -- 5) Split submission_feature_property_timestamp.value into date/time columns
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
    -- 6) Array refactor: dynamic scalar type remap
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

    -- Dynamically infer target scalar type for array-typed properties using existing indexed values.
    -- For properties with no historical indexed rows, default to string.
    -- For mixed historical rows, select the most frequent target type (deterministic tie-breaker by name).
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

    -- Hard-delete feature_property_type='array' once no rows reference it.
    DELETE FROM feature_property_type
    WHERE name = 'array'
      AND record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1) Restore feature_property_type = array and remap migrated properties
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

    DELETE FROM feature_property_type
    WHERE name = 'taxon'
      AND record_end_date IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );

    --------------------------------------------------------------------------------
    -- 2) Restore legacy feature_property_type names
    --    timestamp -> datetime
    --    geometry -> spatial
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
    -- 3) Restore single submission_feature_property_timestamp.value column
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
    -- 4) Remove upload_artifact_role value = codeset
    --------------------------------------------------------------------------------
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM upload_artifact WHERE role::text = 'codeset') THEN
        RAISE EXCEPTION 'Cannot downgrade: upload_artifact contains role = codeset rows';
      END IF;
    END$$;

    ALTER TYPE upload_artifact_role RENAME TO upload_artifact_role_old;

    CREATE TYPE upload_artifact_role AS ENUM (
      'feature',
      'attachment'
    );

    ALTER TABLE upload_artifact
      ALTER COLUMN role TYPE upload_artifact_role
      USING role::text::upload_artifact_role;

    DROP TYPE upload_artifact_role_old;
  `);
}
