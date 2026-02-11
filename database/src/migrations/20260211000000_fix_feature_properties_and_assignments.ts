import { Knex } from 'knex';

/**
 * Fix feature properties and feature-type-property assignments from 20251001000000_insert_feature_types.
 *
 * - Set calculated_value = false for filename, method_attribute, method_value, file_type, file_size
 * - File: filename and file_size required
 * - Report: add filename, file_type, file_size (all required, not computed)
 * - Sample_period: replace sample_technique with method_technique_id
 * - Measurement: add description (optional)
 * - Species_observation: add count (optional)
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- 1. Make five feature properties not computed
    ----------------------------------------------------------------------------------------
    UPDATE feature_property
    SET calculated_value = false
    WHERE name IN (
      'filename',
      'method_attribute',
      'method_value',
      'file_type',
      'file_size'
    )
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 2. File feature type: filename and file_size required
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET required_value = true
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'file' AND record_end_date IS NULL)
    AND feature_property_id IN (
      (SELECT feature_property_id FROM feature_property WHERE name = 'filename' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'file_size' AND record_end_date IS NULL)
    )
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 3. Report feature type: add filename, file_type, file_size (all required)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT ft.feature_type_id, fp.feature_property_id, true
    FROM feature_type ft
    CROSS JOIN feature_property fp
    WHERE ft.name = 'report' AND ft.record_end_date IS NULL
    AND fp.name IN ('filename', 'file_type', 'file_size') AND fp.record_end_date IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = ft.feature_type_id
      AND ftp.feature_property_id = fp.feature_property_id
      AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 4a. Insert method_technique_id feature property
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number' AND record_end_date IS NULL),
      'method_technique_id',
      'Method technique identifier',
      'Identifier of the sampling or method technique.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property
      WHERE name = 'method_technique_id' AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 4b. Sample_period: soft-delete sample_technique link
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET record_end_date = current_date
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period' AND record_end_date IS NULL)
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sample_technique' AND record_end_date IS NULL)
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 4c. Sample_period: add method_technique_id link (optional)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'method_technique_id' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period' AND record_end_date IS NULL)
      AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_technique_id' AND record_end_date IS NULL)
      AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 5. Measurement: add description (optional)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'measurement' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'description' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'measurement' AND record_end_date IS NULL)
      AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'description' AND record_end_date IS NULL)
      AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 6. Species_observation: add count (optional)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'count' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
      AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'count' AND record_end_date IS NULL)
      AND ftp.record_end_date IS NULL
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- 6. Species_observation: remove count link
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'count' AND record_end_date IS NULL);

    ----------------------------------------------------------------------------------------
    -- 5. Measurement: remove description link
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'measurement' AND record_end_date IS NULL)
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'description' AND record_end_date IS NULL);

    ----------------------------------------------------------------------------------------
    -- 4c. Sample_period: remove method_technique_id link
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET record_end_date = current_date
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period' AND record_end_date IS NULL)
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_technique_id' AND record_end_date IS NULL)
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 4b. Sample_period: restore sample_technique link (clear soft-delete)
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period' AND record_end_date IS NULL)
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sample_technique' AND record_end_date IS NULL)
    AND record_end_date IS NOT NULL;

    ----------------------------------------------------------------------------------------
    -- 4a. Soft-delete method_technique_id feature property
    ----------------------------------------------------------------------------------------
    UPDATE feature_property
    SET record_end_date = current_date
    WHERE name = 'method_technique_id' AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 3. Report: remove filename, file_type, file_size links
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'report' AND record_end_date IS NULL)
    AND feature_property_id IN (
      (SELECT feature_property_id FROM feature_property WHERE name = 'filename' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'file_type' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'file_size' AND record_end_date IS NULL)
    );

    ----------------------------------------------------------------------------------------
    -- 2. File: filename and file_size back to optional
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET required_value = false
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'file' AND record_end_date IS NULL)
    AND feature_property_id IN (
      (SELECT feature_property_id FROM feature_property WHERE name = 'filename' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'file_size' AND record_end_date IS NULL)
    )
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 1. Restore calculated_value = true for the five properties
    ----------------------------------------------------------------------------------------
    UPDATE feature_property
    SET calculated_value = true
    WHERE name IN (
      'filename',
      'method_attribute',
      'method_value',
      'file_type',
      'file_size'
    )
    AND record_end_date IS NULL;
  `);
}
