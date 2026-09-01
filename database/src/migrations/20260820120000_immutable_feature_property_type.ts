import type { Knex } from 'knex';

/**
 * Prevent a feature property from changing storage types after it has been created.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    ----------------------------------------------------------------------------------------
    -- 1. Restore taxon_id's original number storage type.
    --
    -- Taxon-backed rows store biohub.taxon.taxon_id, an internal surrogate key. The numeric
    -- taxon_id property historically stores the public ITIS TSN, so translate through taxon
    -- rather than copying the surrogate key into the number table.
    ----------------------------------------------------------------------------------------
    INSERT INTO submission_feature_property_number (
      submission_feature_id,
      feature_type_property_id,
      blueprint_feature_type_property_id,
      value,
      create_date,
      create_user,
      update_date,
      update_user,
      revision_count
    )
    SELECT
      taxon_value.submission_feature_id,
      taxon_value.feature_type_property_id,
      taxon_value.blueprint_feature_type_property_id,
      taxon.itis_tsn,
      taxon_value.create_date,
      taxon_value.create_user,
      taxon_value.update_date,
      taxon_value.update_user,
      taxon_value.revision_count
    FROM submission_feature_property_taxon taxon_value
    JOIN feature_type_property ftp
      ON ftp.feature_type_property_id = taxon_value.feature_type_property_id
    JOIN feature_property fp
      ON fp.feature_property_id = ftp.feature_property_id
    JOIN taxon
      ON taxon.taxon_id = taxon_value.taxon_id
    WHERE fp.name = 'taxon_id'
      AND NOT EXISTS (
        SELECT 1
        FROM submission_feature_property_number number_value
        WHERE number_value.submission_feature_id = taxon_value.submission_feature_id
          AND number_value.feature_type_property_id = taxon_value.feature_type_property_id
          AND number_value.value = taxon.itis_tsn
      );

    DELETE FROM submission_feature_property_taxon taxon_value
    USING feature_type_property ftp, feature_property fp
    WHERE ftp.feature_type_property_id = taxon_value.feature_type_property_id
      AND fp.feature_property_id = ftp.feature_property_id
      AND fp.name = 'taxon_id';

    UPDATE feature_property fp
    SET feature_property_type_id = number_type.feature_property_type_id
    FROM feature_property_type number_type
    WHERE fp.name = 'taxon_id'
      AND number_type.name = 'number'
      AND number_type.record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 2. Prevent future feature property type changes.
    ----------------------------------------------------------------------------------------
    CREATE FUNCTION tr_prevent_feature_property_type_update()
      RETURNS trigger
      LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.feature_property_type_id IS DISTINCT FROM NEW.feature_property_type_id THEN
        RAISE EXCEPTION
          'feature_property.feature_property_type_id is immutable for feature_property_id % (old %, new %)',
          OLD.feature_property_id,
          OLD.feature_property_type_id,
          NEW.feature_property_type_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER prevent_feature_property_type_update
      BEFORE UPDATE OF feature_property_type_id ON feature_property
      FOR EACH ROW EXECUTE PROCEDURE tr_prevent_feature_property_type_update();
  `);
}

/**
 * Remove the feature property type immutability guard.
 *
 * @param {Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`--sql
    SET SEARCH_PATH = biohub, public;

    DROP TRIGGER IF EXISTS prevent_feature_property_type_update ON feature_property;
    DROP FUNCTION IF EXISTS tr_prevent_feature_property_type_update();

    -- The taxon_id repair is intentionally not reversed. Converting numeric ITIS TSNs back to
    -- internal taxon references is not guaranteed to be possible, and would recreate mixed storage.
  `);
}
