import { Knex } from 'knex';

/**
 * Retype the two partnership feature properties from the unsupported `array` type to `string`.
 *
 * `indigenous_partnerships` and `stakeholder_partnerships` were inserted as `array`-typed properties
 * (20260113000000_add_codeset_feature_type) and were never converted by the array-removal migration
 * (20260530120000_allow_multiple_array_properties), which only retyped focal_species, associated_species,
 * site_select_strategy, collected_data, and attractant. The ingestion validator treats `array` as an
 * unsupported property type (UNSUPPORTED_PROPERTY_TYPE), so any published partnership values fail.
 *
 * SIMS publishes both as arrays of plain strings, so they are modelled here as `string` properties with
 * `allow_multiple = true`. Retyping these is also what finally allows the now-unused `array`
 * feature_property_type to be dropped, completing the cleanup started in 20260530120000.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SEARCH_PATH = biohub, public;

    --------------------------------------------------------------------------------
    -- 1. Ensure allow_multiple = true on the partnership feature_type_property rows
    --------------------------------------------------------------------------------
    UPDATE feature_type_property ftp
    SET allow_multiple = true
    FROM feature_property fp
    WHERE ftp.feature_property_id = fp.feature_property_id
      AND fp.name IN ('indigenous_partnerships', 'stakeholder_partnerships')
      AND fp.record_end_date IS NULL
      AND ftp.record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 2. Retype both partnership properties from array -> string
    --------------------------------------------------------------------------------
    UPDATE feature_property
    SET feature_property_type_id = (
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string' AND record_end_date IS NULL
    )
    WHERE name IN ('indigenous_partnerships', 'stakeholder_partnerships')
      AND record_end_date IS NULL;

    --------------------------------------------------------------------------------
    -- 3. Drop the now-unused 'array' feature_property_type if nothing references it
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
    -- 2. Retype both partnership properties back to array
    --------------------------------------------------------------------------------
    UPDATE feature_property
    SET feature_property_type_id = (
      SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array' AND record_end_date IS NULL
    )
    WHERE name IN ('indigenous_partnerships', 'stakeholder_partnerships')
      AND record_end_date IS NULL;
  `);
}
