import { Knex } from 'knex';

/**
 * Collapse five child feature types into their parent feature types.
 *
 * - observation_environmental_condition, observation_subcount, observation_subcount_measurement → species_observation
 * - sample_technique_detail, sample_technique_vantage → sample_technique
 *
 * Adds new feature properties (subcount_*, vantage_*), assigns all listed properties to parents
 * as optional (required_value = false), migrates submission_feature rows and data JSONB keys,
 * then soft-deletes the child feature types and their feature_type_property assignments.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- 1. Insert new feature properties (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string' AND record_end_date IS NULL),
      'subcount_comment',
      'Subcount comment',
      'Comment for an observation subcount.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'subcount_comment' AND record_end_date IS NULL
    );

    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number' AND record_end_date IS NULL),
      'subcount_count',
      'Subcount count',
      'Count for an observation subcount.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'subcount_count' AND record_end_date IS NULL
    );

    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string' AND record_end_date IS NULL),
      'subcount_measurement_type',
      'Subcount measurement type',
      'The type of measurement for an observation subcount.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'subcount_measurement_type' AND record_end_date IS NULL
    );

    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number' AND record_end_date IS NULL),
      'subcount_measurement_value',
      'Subcount measurement value',
      'The value of the measurement for an observation subcount.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'subcount_measurement_value' AND record_end_date IS NULL
    );

    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string' AND record_end_date IS NULL),
      'vantage_method_attribute',
      'Vantage method attribute',
      'Key characteristics of the vantage point or method used to observe or collect data.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'vantage_method_attribute' AND record_end_date IS NULL
    );

    INSERT INTO feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
      (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string' AND record_end_date IS NULL),
      'vantage_method_value',
      'Vantage method value',
      'Value of the vantage point or method used to observe or collect data.',
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_property WHERE name = 'vantage_method_value' AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 2. Assign properties to species_observation (all optional)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition_value' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition_value' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_comment' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_comment' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_count' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_count' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_measurement_type' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_measurement_type' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_measurement_value' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'subcount_measurement_value' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 3. Assign properties to sample_technique (all optional)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'method_attribute' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_attribute' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'method_value' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_value' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_method_attribute' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_method_attribute' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    INSERT INTO feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
      (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL),
      (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_method_value' AND record_end_date IS NULL),
      false
    WHERE NOT EXISTS (
      SELECT 1 FROM feature_type_property ftp
      WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
        AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_method_value' AND record_end_date IS NULL)
        AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- 4. Data migration: reassign submission_feature rows and transform data
    ----------------------------------------------------------------------------------------
    -- 4a. observation_environmental_condition → species_observation (no key renames)
    UPDATE submission_feature sf
    SET feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition' AND record_end_date IS NULL);

    -- 4b. observation_subcount → species_observation (comment → subcount_comment, count → subcount_count)
    UPDATE submission_feature sf
    SET
      feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      data = (sf.data - 'comment' - 'count') || jsonb_build_object(
        'subcount_comment', sf.data->'comment',
        'subcount_count', sf.data->'count'
      )
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount' AND record_end_date IS NULL);

    -- 4c. observation_subcount_measurement → species_observation (measurement_type → subcount_measurement_type, measurement_value → subcount_measurement_value)
    UPDATE submission_feature sf
    SET
      feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL),
      data = (sf.data - 'measurement_type' - 'measurement_value') || jsonb_build_object(
        'subcount_measurement_type', sf.data->'measurement_type',
        'subcount_measurement_value', sf.data->'measurement_value'
      )
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount_measurement' AND record_end_date IS NULL);

    -- 4d. sample_technique_detail → sample_technique (no key renames)
    UPDATE submission_feature sf
    SET feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail' AND record_end_date IS NULL);

    -- 4e. sample_technique_vantage → sample_technique (method_vantage → vantage_method_attribute, method_value → vantage_method_value)
    UPDATE submission_feature sf
    SET
      feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL),
      data = (sf.data - 'method_vantage' - 'method_value') || jsonb_build_object(
        'vantage_method_attribute', sf.data->'method_vantage',
        'vantage_method_value', sf.data->'method_value'
      )
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage' AND record_end_date IS NULL);

    ----------------------------------------------------------------------------------------
    -- 5. Soft-delete feature_type_property for the 5 child types (before soft-deleting types)
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property
    SET record_end_date = current_date
    WHERE feature_type_id IN (
      SELECT feature_type_id FROM feature_type
      WHERE name IN (
        'observation_environmental_condition',
        'observation_subcount',
        'observation_subcount_measurement',
        'sample_technique_detail',
        'sample_technique_vantage'
      )
      AND record_end_date IS NULL
    )
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 6. Soft-delete the 5 child feature types
    ----------------------------------------------------------------------------------------
    UPDATE feature_type
    SET record_end_date = current_date
    WHERE name IN (
      'observation_environmental_condition',
      'observation_subcount',
      'observation_subcount_measurement',
      'sample_technique_detail',
      'sample_technique_vantage'
    )
    AND record_end_date IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    -- Down migration is best-effort: we do not restore submission_feature rows to child types
    -- or revert data key renames, as that would require tracking which rows were migrated.
    -- Restore soft-deleted feature types and their property assignments so the schema is
    -- back to the pre-collapse state (existing submission_feature rows remain as parent type).

    ----------------------------------------------------------------------------------------
    -- 1. Restore the 5 child feature types (clear record_end_date)
    ----------------------------------------------------------------------------------------
    UPDATE feature_type
    SET record_end_date = NULL
    WHERE name IN (
      'observation_environmental_condition',
      'observation_subcount',
      'observation_subcount_measurement',
      'sample_technique_detail',
      'sample_technique_vantage'
    )
    AND record_end_date IS NOT NULL;

    ----------------------------------------------------------------------------------------
    -- 2. Restore feature_type_property for the 5 child types
    ----------------------------------------------------------------------------------------
    UPDATE feature_type_property ftp
    SET record_end_date = NULL
    WHERE ftp.feature_type_id IN (
      SELECT feature_type_id FROM feature_type
      WHERE name IN (
        'observation_environmental_condition',
        'observation_subcount',
        'observation_subcount_measurement',
        'sample_technique_detail',
        'sample_technique_vantage'
      )
    )
    AND ftp.record_end_date IS NOT NULL;

    ----------------------------------------------------------------------------------------
    -- 3. Remove parent feature_type_property assignments added by this migration
    ----------------------------------------------------------------------------------------
    -- species_observation: remove environmental_condition, environmental_condition_value, subcount_*
    UPDATE feature_type_property
    SET record_end_date = current_date
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation' AND record_end_date IS NULL)
    AND feature_property_id IN (
      SELECT feature_property_id FROM feature_property WHERE name IN (
        'environmental_condition', 'environmental_condition_value',
        'subcount_comment', 'subcount_count', 'subcount_measurement_type', 'subcount_measurement_value'
      ) AND record_end_date IS NULL
    )
    AND record_end_date IS NULL;

    -- sample_technique: remove method_attribute, method_value, vantage_method_*
    UPDATE feature_type_property
    SET record_end_date = current_date
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique' AND record_end_date IS NULL)
    AND feature_property_id IN (
      SELECT feature_property_id FROM feature_property WHERE name IN (
        'method_attribute', 'method_value', 'vantage_method_attribute', 'vantage_method_value'
      ) AND record_end_date IS NULL
    )
    AND record_end_date IS NULL;

    ----------------------------------------------------------------------------------------
    -- 4. Soft-delete the new feature_property rows (subcount_*, vantage_*)
    ----------------------------------------------------------------------------------------
    UPDATE feature_property
    SET record_end_date = current_date
    WHERE name IN (
      'subcount_comment', 'subcount_count', 'subcount_measurement_type', 'subcount_measurement_value',
      'vantage_method_attribute', 'vantage_method_value'
    )
    AND record_end_date IS NULL;
  `);
}
