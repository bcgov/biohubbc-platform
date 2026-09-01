import type { Knex } from 'knex';

/**
 * Require a property value to live in the storage table matching its declared type.
 *
 * `submission_feature_property_*` records where a value was stored; `feature_property_type` records
 * what the property is declared as. Nothing tied the two together, so a value could be written to a
 * table that disagreed with its own declaration. The export path keys values by property name and
 * builds its Parquet schema from the declared type, so such a row hands the writer a value the
 * column cannot hold and the whole download fails.
 *
 * The guard added in `20260827120000` checks only that the assignment belongs to the feature's own
 * feature type, which says nothing about storage, so those rows pass it. This extends that same
 * function with the second invariant rather than adding a second trigger: both resolve from the one
 * lookup it already does, so ingest stays at a single lookup per row. The nine triggers it created
 * already fire on the columns read here, so they are left in place.
 *
 * The declaration is resolved without filtering `record_end_date`, so a value written against an
 * end-dated property or assignment is still accepted, and one already stored stays readable.
 * Submitted data outlives the declaration it was captured under and still has to reach the export.
 *
 * This migration is a guard only. It does not repair existing rows: the bad rows that prompted it
 * came from seed data, which loads only under the `development` knexfile environment, and they were
 * removed by hand.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
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
  `);
}

/**
 * Restore the feature-type-only assignment guard from `20260827120000`.
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
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM submission_feature sf
        JOIN feature_type_property ftp
          ON ftp.feature_type_id = sf.feature_type_id
        WHERE sf.submission_feature_id = NEW.submission_feature_id
          AND ftp.feature_type_property_id = NEW.feature_type_property_id
      ) THEN
        RAISE EXCEPTION
          'feature_type_property_id % does not belong to the feature type for submission_feature_id %',
          NEW.feature_type_property_id,
          NEW.submission_feature_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      RETURN NEW;
    END;
    $$;
  `);
}
