import { Knex } from 'knex';

/**
 * Converts all array-typed feature_property rows to their appropriate scalar types,
 * sets allow_multiple = true for their feature_type_property rows, then drops the
 * now-unused 'array' feature_property_type.
 *
 * Scalar mapping:
 *   focal_species      -> taxon
 *   associated_species -> taxon
 *   site_select_strategy -> code
 *   collected_data     -> code
 *   attractant         -> code
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1. Ensure the 'code' feature_property_type exists
    --------------------------------------------------------------------------------
    INSERT INTO feature_property_type (name, description)
    SELECT 'code', 'A code reference type (code::<codeset>::<code> slug)'
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property_type WHERE name = 'code' AND record_end_date IS NULL
    );

    --------------------------------------------------------------------------------
    -- 2. Set allow_multiple = true for all feature_type_property rows whose
    --    feature_property is currently typed as 'array' (before retyping, while
    --    the 'array' link still identifies the full set).
    --------------------------------------------------------------------------------
    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM feature_property fp
    JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE ftp.feature_property_id = fp.feature_property_id
      AND fpt.name = 'array';

    --------------------------------------------------------------------------------
    -- 3. Retype each array property to its scalar type
    --------------------------------------------------------------------------------
    UPDATE feature_property
    SET feature_property_type_id = (
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'taxon' AND record_end_date IS NULL
    )
    WHERE name IN ('focal_species', 'associated_species')
      AND record_end_date IS NULL;

    UPDATE feature_property
    SET feature_property_type_id = (
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'code' AND record_end_date IS NULL
    )
    WHERE name IN ('site_select_strategy', 'collected_data', 'attractant')
      AND record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 4. Drop the 'array' feature_property_type now that no properties reference it
    --------------------------------------------------------------------------------
    DELETE FROM feature_property_type
    WHERE name = 'array'
      AND NOT EXISTS (
        SELECT 1 FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1. Re-insert the 'array' feature_property_type
    --------------------------------------------------------------------------------
    INSERT INTO feature_property_type (name, description)
    SELECT 'array', 'An array type'
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property_type WHERE name = 'array' AND record_end_date IS NULL
    );

    --------------------------------------------------------------------------------
    -- 2. Retype the five properties back to 'array'
    --------------------------------------------------------------------------------
    UPDATE feature_property
    SET feature_property_type_id = (
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array' AND record_end_date IS NULL
    )
    WHERE name IN ('focal_species', 'associated_species', 'site_select_strategy', 'collected_data', 'attractant')
      AND record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 3. Reset allow_multiple = false for the reverted properties
    --------------------------------------------------------------------------------
    UPDATE feature_type_property ftp
    SET allow_multiple = false
    FROM feature_property fp
    JOIN feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
    WHERE ftp.feature_property_id = fp.feature_property_id
      AND fpt.name = 'array';

    --------------------------------------------------------------------------------
    -- 4. Drop the 'code' feature_property_type if nothing references it
    --------------------------------------------------------------------------------
    DELETE FROM feature_property_type
    WHERE name = 'code'
      AND NOT EXISTS (
        SELECT 1 FROM feature_property fp
        WHERE fp.feature_property_type_id = feature_property_type.feature_property_type_id
      );
  `);
}
