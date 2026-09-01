import type { Knex } from 'knex';

/**
 * Remove canonical property rows assigned to the wrong feature type and prevent new mismatches.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    CREATE FUNCTION tr_validate_submission_feature_property_assignment()
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

    DO $do$
    DECLARE
      property_table text;
    BEGIN
      FOREACH property_table IN ARRAY ARRAY[
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
        EXECUTE format($delete$
          DELETE FROM %I property_value
          USING submission_feature sf, feature_type_property ftp
          WHERE sf.submission_feature_id = property_value.submission_feature_id
            AND ftp.feature_type_property_id = property_value.feature_type_property_id
            AND sf.feature_type_id <> ftp.feature_type_id
        $delete$, property_table);

        EXECUTE format(
          'CREATE TRIGGER validate_submission_feature_property_assignment BEFORE INSERT OR UPDATE OF submission_feature_id, feature_type_property_id ON %I FOR EACH ROW EXECUTE PROCEDURE tr_validate_submission_feature_property_assignment()',
          property_table
        );
      END LOOP;
    END
    $do$;
  `);
}

/**
 * Remove the property-assignment guard. Deleted invalid rows are intentionally not restored.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DO $do$
    DECLARE
      property_table text;
    BEGIN
      FOREACH property_table IN ARRAY ARRAY[
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
        EXECUTE format(
          'DROP TRIGGER IF EXISTS validate_submission_feature_property_assignment ON %I',
          property_table
        );
      END LOOP;
    END
    $do$;

    DROP FUNCTION IF EXISTS tr_validate_submission_feature_property_assignment();
  `);
}
