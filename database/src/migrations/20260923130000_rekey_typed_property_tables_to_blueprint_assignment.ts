import type { Knex } from 'knex';

/**
 * Validate and index stored property values by their Blueprint assignment.
 *
 * With the assignment required on every value (`20260923120000`), it is the reference that identifies
 * the property, its feature type, its Blueprint and its declared storage type. The write-time guard on
 * the nine `submission_feature_property_*` tables resolves all four from it in one lookup and requires:
 * the assignment's feature type is the feature's; the assignment's Blueprint is the one pinned to the
 * feature's upload; the property's declared type is the one the table stores. A retired assignment is
 * accepted: a value written against a superseded Blueprint version stays valid under it.
 *
 * The search indexes of `20260902120000`, the geometry presence index of `20260713140000` and the
 * feature-lookup indexes of the reference and artifact tables are rebuilt under the same names with the
 * assignment in place of the global pairing, so the evaluation, Martin and hydration paths that were
 * planned against them keep their access paths. The single-column assignment indexes of `20260625120000`
 * are covered by the rebuilt ones and are dropped. The uniqueness of reference and artifact values is
 * re-expressed on the assignment.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Resolve the assignment's feature type, Blueprint and declared type in one lookup.
    ----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_property_assignment()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_type text;
      assignment record;
    BEGIN
      -- The property type each storage table holds. Three names differ from their table suffix:
      -- timestamp/datetime, geometry/spatial, artifact/artifact_key.
      expected_type := CASE TG_TABLE_NAME
        WHEN 'submission_feature_property_string' THEN 'string'
        WHEN 'submission_feature_property_number' THEN 'number'
        WHEN 'submission_feature_property_boolean' THEN 'boolean'
        WHEN 'submission_feature_property_timestamp' THEN 'datetime'
        WHEN 'submission_feature_property_code' THEN 'code'
        WHEN 'submission_feature_property_taxon' THEN 'taxon'
        WHEN 'submission_feature_property_geometry' THEN 'spatial'
        WHEN 'submission_feature_property_feature' THEN 'feature'
        WHEN 'submission_feature_property_artifact' THEN 'artifact_key'
      END;

      SELECT
        bft.feature_type_id AS assigned_feature_type_id,
        bft.blueprint_id AS assigned_blueprint_id,
        sf.feature_type_id AS owning_feature_type_id,
        su.blueprint_id AS owning_blueprint_id,
        fpt.name AS declared_type
      INTO assignment
      FROM submission_feature sf
      JOIN submission_upload su
        ON su.submission_upload_id = sf.submission_upload_id
      JOIN blueprint_feature_type_property bftp
        ON bftp.blueprint_feature_type_property_id = NEW.blueprint_feature_type_property_id
      JOIN blueprint_feature_type bft
        ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
      JOIN feature_property fp
        ON fp.feature_property_id = bftp.feature_property_id
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE sf.submission_feature_id = NEW.submission_feature_id;

      IF NOT FOUND OR assignment.assigned_feature_type_id <> assignment.owning_feature_type_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          NEW.blueprint_feature_type_property_id,
          NEW.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.assigned_blueprint_id <> assignment.owning_blueprint_id THEN
        RAISE EXCEPTION
          'blueprint_feature_type_property_id % belongs to blueprint %, but submission_feature_id % was uploaded under blueprint %',
          NEW.blueprint_feature_type_property_id,
          assignment.assigned_blueprint_id,
          NEW.submission_feature_id,
          assignment.owning_blueprint_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.declared_type <> expected_type THEN
        RAISE EXCEPTION
          '% stores % properties, but blueprint_feature_type_property_id % is declared as %',
          TG_TABLE_NAME,
          expected_type,
          NEW.blueprint_feature_type_property_id,
          assignment.declared_type
          USING ERRCODE = 'datatype_mismatch';
      END IF;

      RETURN NEW;
    END;
    $$;

    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON %I', tbl);
        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment BEFORE INSERT OR UPDATE OF submission_feature_id, blueprint_feature_type_property_id ON %I FOR EACH ROW EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment()',
          tbl
        );
        EXECUTE format('DROP INDEX IF EXISTS %I', tbl || '_bftp_idx');
      END LOOP;
    END
    $do$;

    ----------------------------------------------------------------------------------------
    -- 2. Property predicate indexes: one assignment and value, then the owning feature.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_string_idx2;
    DROP INDEX IF EXISTS submission_feature_property_number_idx2;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx5;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx6;
    DROP INDEX IF EXISTS submission_feature_property_geometry_idx2;
    DROP INDEX IF EXISTS submission_feature_property_code_idx2;
    DROP INDEX IF EXISTS submission_feature_property_taxon_idx2;

    CREATE INDEX submission_feature_property_string_idx2
      ON submission_feature_property_string (blueprint_feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_number_idx2
      ON submission_feature_property_number (blueprint_feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_boolean_idx2
      ON submission_feature_property_boolean (blueprint_feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx2
      ON submission_feature_property_timestamp (blueprint_feature_type_property_id, date_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx5
      ON submission_feature_property_timestamp (blueprint_feature_type_property_id, time_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx6
      ON submission_feature_property_timestamp
        (blueprint_feature_type_property_id, (date_value + time_value), submission_feature_id)
      WHERE date_value IS NOT NULL AND time_value IS NOT NULL;
    CREATE INDEX submission_feature_property_geometry_idx2
      ON submission_feature_property_geometry (blueprint_feature_type_property_id, submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2
      ON submission_feature_property_code (blueprint_feature_type_property_id, contributor_codeset_code_id, submission_feature_id);
    CREATE INDEX submission_feature_property_taxon_idx2
      ON submission_feature_property_taxon (blueprint_feature_type_property_id, taxon_id, submission_feature_id);

    ----------------------------------------------------------------------------------------
    -- 3. Feature-lookup indexes: a feature, then its assignments, with values included where the
    --    probe can stay index-only. Geometry keeps its presence index for the tile functions.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_string_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_geometry_presence_idx;

    CREATE INDEX submission_feature_property_string_presence_idx
      ON submission_feature_property_string (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_presence_idx
      ON submission_feature_property_number (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_presence_idx
      ON submission_feature_property_boolean (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_presence_idx
      ON submission_feature_property_timestamp (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_presence_idx
      ON submission_feature_property_code (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_presence_idx
      ON submission_feature_property_taxon (submission_feature_id, blueprint_feature_type_property_id)
      INCLUDE (taxon_id);
    CREATE INDEX submission_feature_property_geometry_presence_idx
      ON submission_feature_property_geometry (submission_feature_id, blueprint_feature_type_property_id);

    ----------------------------------------------------------------------------------------
    -- 4. Property count indexes: one assignment, deduplicated by feature.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_string_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_count_idx;

    CREATE INDEX submission_feature_property_string_count_idx
      ON submission_feature_property_string (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_count_idx
      ON submission_feature_property_number (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_count_idx
      ON submission_feature_property_boolean (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_count_idx
      ON submission_feature_property_timestamp (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_count_idx
      ON submission_feature_property_code (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_count_idx
      ON submission_feature_property_taxon (blueprint_feature_type_property_id, submission_feature_id)
      INCLUDE (taxon_id);

    ----------------------------------------------------------------------------------------
    -- 5. Reference and artifact values: lookups and uniqueness on the assignment.
    ----------------------------------------------------------------------------------------
    DROP INDEX IF EXISTS submission_feature_property_feature_idx1;
    DROP INDEX IF EXISTS submission_feature_property_feature_idx2;
    ALTER TABLE submission_feature_property_feature
      DROP CONSTRAINT IF EXISTS submission_feature_property_feature_uk1;

    CREATE INDEX submission_feature_property_feature_idx1
      ON submission_feature_property_feature (submission_feature_id, blueprint_feature_type_property_id);
    CREATE INDEX submission_feature_property_feature_idx2
      ON submission_feature_property_feature (blueprint_feature_type_property_id, referenced_submission_feature_id, submission_feature_id);
    ALTER TABLE submission_feature_property_feature
      ADD CONSTRAINT submission_feature_property_feature_uk2
      UNIQUE (submission_feature_id, blueprint_feature_type_property_id, referenced_submission_feature_id);

    DROP INDEX IF EXISTS submission_feature_property_artifact_idx1;
    DROP INDEX IF EXISTS submission_feature_property_artifact_idx2;
    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_uk1;

    CREATE INDEX submission_feature_property_artifact_idx1
      ON submission_feature_property_artifact (submission_feature_id, blueprint_feature_type_property_id);
    CREATE INDEX submission_feature_property_artifact_idx2
      ON submission_feature_property_artifact (blueprint_feature_type_property_id, artifact_id, submission_feature_id);
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_uk2
      UNIQUE (submission_feature_id, blueprint_feature_type_property_id, artifact_id);
  `);
}

/**
 * Reverses {@link up}: the guard from `20260827130000` and the indexes and keys on the global pairing.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE OR REPLACE FUNCTION tr_validate_submission_feature_property_assignment()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    DECLARE
      expected_type text;
      assignment record;
    BEGIN
      expected_type := CASE TG_TABLE_NAME
        WHEN 'submission_feature_property_string' THEN 'string'
        WHEN 'submission_feature_property_number' THEN 'number'
        WHEN 'submission_feature_property_boolean' THEN 'boolean'
        WHEN 'submission_feature_property_timestamp' THEN 'datetime'
        WHEN 'submission_feature_property_code' THEN 'code'
        WHEN 'submission_feature_property_taxon' THEN 'taxon'
        WHEN 'submission_feature_property_geometry' THEN 'spatial'
        WHEN 'submission_feature_property_feature' THEN 'feature'
        WHEN 'submission_feature_property_artifact' THEN 'artifact_key'
      END;

      SELECT
        ftp.feature_type_id AS assigned_feature_type_id,
        sf.feature_type_id AS owning_feature_type_id,
        fpt.name AS declared_type
      INTO assignment
      FROM submission_feature sf
      JOIN feature_type_property ftp
        ON ftp.feature_type_property_id = NEW.feature_type_property_id
      JOIN feature_property fp
        ON fp.feature_property_id = ftp.feature_property_id
      JOIN feature_property_type fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE sf.submission_feature_id = NEW.submission_feature_id;

      IF NOT FOUND OR assignment.assigned_feature_type_id <> assignment.owning_feature_type_id THEN
        RAISE EXCEPTION
          'feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          NEW.feature_type_property_id,
          NEW.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF assignment.declared_type <> expected_type THEN
        RAISE EXCEPTION
          '% stores % properties, but feature_type_property_id % is declared as %',
          TG_TABLE_NAME,
          expected_type,
          NEW.feature_type_property_id,
          assignment.declared_type
          USING ERRCODE = 'datatype_mismatch';
      END IF;

      RETURN NEW;
    END;
    $$;

    DO $do$
    DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_timestamp',
        'submission_feature_property_code',
        'submission_feature_property_taxon',
        'submission_feature_property_geometry',
        'submission_feature_property_feature',
        'submission_feature_property_artifact'
      ]
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON %I', tbl);
        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment BEFORE INSERT OR UPDATE OF submission_feature_id, feature_type_property_id ON %I FOR EACH ROW EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment()',
          tbl
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (blueprint_feature_type_property_id)', tbl || '_bftp_idx', tbl);
      END LOOP;
    END
    $do$;

    DROP INDEX IF EXISTS submission_feature_property_string_idx2;
    DROP INDEX IF EXISTS submission_feature_property_number_idx2;
    DROP INDEX IF EXISTS submission_feature_property_boolean_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx2;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx5;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_idx6;
    DROP INDEX IF EXISTS submission_feature_property_geometry_idx2;
    DROP INDEX IF EXISTS submission_feature_property_code_idx2;
    DROP INDEX IF EXISTS submission_feature_property_taxon_idx2;
    CREATE INDEX submission_feature_property_string_idx2
      ON submission_feature_property_string (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_number_idx2
      ON submission_feature_property_number (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_boolean_idx2
      ON submission_feature_property_boolean (feature_type_property_id, value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx2
      ON submission_feature_property_timestamp (feature_type_property_id, date_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx5
      ON submission_feature_property_timestamp (feature_type_property_id, time_value, submission_feature_id);
    CREATE INDEX submission_feature_property_timestamp_idx6
      ON submission_feature_property_timestamp
        (feature_type_property_id, (date_value + time_value), submission_feature_id)
      WHERE date_value IS NOT NULL AND time_value IS NOT NULL;
    CREATE INDEX submission_feature_property_geometry_idx2
      ON submission_feature_property_geometry (feature_type_property_id, submission_feature_id);
    CREATE INDEX submission_feature_property_code_idx2
      ON submission_feature_property_code (feature_type_property_id, contributor_codeset_code_id, submission_feature_id);
    CREATE INDEX submission_feature_property_taxon_idx2
      ON submission_feature_property_taxon (feature_type_property_id, taxon_id, submission_feature_id);

    DROP INDEX IF EXISTS submission_feature_property_string_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_presence_idx;
    DROP INDEX IF EXISTS submission_feature_property_geometry_presence_idx;
    CREATE INDEX submission_feature_property_string_presence_idx
      ON submission_feature_property_string (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_presence_idx
      ON submission_feature_property_number (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_presence_idx
      ON submission_feature_property_boolean (submission_feature_id, feature_type_property_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_presence_idx
      ON submission_feature_property_timestamp (submission_feature_id, feature_type_property_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_presence_idx
      ON submission_feature_property_code (submission_feature_id, feature_type_property_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_presence_idx
      ON submission_feature_property_taxon (submission_feature_id, feature_type_property_id)
      INCLUDE (taxon_id);
    CREATE INDEX submission_feature_property_geometry_presence_idx
      ON submission_feature_property_geometry (submission_feature_id, feature_type_property_id);

    DROP INDEX IF EXISTS submission_feature_property_string_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_number_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_boolean_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_timestamp_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_code_count_idx;
    DROP INDEX IF EXISTS submission_feature_property_taxon_count_idx;
    CREATE INDEX submission_feature_property_string_count_idx
      ON submission_feature_property_string (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_number_count_idx
      ON submission_feature_property_number (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_boolean_count_idx
      ON submission_feature_property_boolean (feature_type_property_id, submission_feature_id)
      INCLUDE (value);
    CREATE INDEX submission_feature_property_timestamp_count_idx
      ON submission_feature_property_timestamp (feature_type_property_id, submission_feature_id)
      INCLUDE (date_value, time_value);
    CREATE INDEX submission_feature_property_code_count_idx
      ON submission_feature_property_code (feature_type_property_id, submission_feature_id)
      INCLUDE (contributor_codeset_code_id);
    CREATE INDEX submission_feature_property_taxon_count_idx
      ON submission_feature_property_taxon (feature_type_property_id, submission_feature_id)
      INCLUDE (taxon_id);

    DROP INDEX IF EXISTS submission_feature_property_feature_idx1;
    DROP INDEX IF EXISTS submission_feature_property_feature_idx2;
    ALTER TABLE submission_feature_property_feature
      DROP CONSTRAINT IF EXISTS submission_feature_property_feature_uk2;
    CREATE INDEX submission_feature_property_feature_idx1
      ON submission_feature_property_feature (submission_feature_id, feature_type_property_id);
    CREATE INDEX submission_feature_property_feature_idx2
      ON submission_feature_property_feature (feature_type_property_id, referenced_submission_feature_id, submission_feature_id);
    ALTER TABLE submission_feature_property_feature
      ADD CONSTRAINT submission_feature_property_feature_uk1
      UNIQUE (submission_feature_id, feature_type_property_id, referenced_submission_feature_id);

    DROP INDEX IF EXISTS submission_feature_property_artifact_idx1;
    DROP INDEX IF EXISTS submission_feature_property_artifact_idx2;
    ALTER TABLE submission_feature_property_artifact
      DROP CONSTRAINT IF EXISTS submission_feature_property_artifact_uk2;
    CREATE INDEX submission_feature_property_artifact_idx1
      ON submission_feature_property_artifact (submission_feature_id, feature_type_property_id);
    CREATE INDEX submission_feature_property_artifact_idx2
      ON submission_feature_property_artifact (feature_type_property_id, artifact_id, submission_feature_id);
    ALTER TABLE submission_feature_property_artifact
      ADD CONSTRAINT submission_feature_property_artifact_uk1
      UNIQUE (submission_feature_id, feature_type_property_id, artifact_id);
  `);
}
