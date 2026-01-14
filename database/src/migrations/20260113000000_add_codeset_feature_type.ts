import { Knex } from 'knex';

/**
 * Add codeset feature type and migrate feature properties from string values to code table ID references.
 *
 * This migration:
 * 1. Adds the 'codeset' feature type with 'categories' property
 * 2. Adds new ID-based feature properties (using string type to support PKs and GUIDs)
 * 3. Links new properties to their respective feature types
 * 4. Soft-deletes old string-based property-to-type links
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Insert codeset feature type
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type (name, display_name, description)
    VALUES (
        'codeset',
        'Codeset',
        'A code table containing standardized categories and code values.'
    );

    ----------------------------------------------------------------------------------------
    -- Insert categories feature property
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    VALUES (
        (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array'),
        'categories',
        'Categories',
        'An array of categories, each containing standardized code values.',
        false
    );

    ----------------------------------------------------------------------------------------
    -- Link categories property to codeset feature type
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_type_property (feature_type_id, feature_property_id, required_value)
    VALUES (
        (SELECT feature_type_id FROM feature_type WHERE name = 'codeset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'categories'),
        true
    );

    ----------------------------------------------------------------------------------------
    -- Insert new ID-based feature properties
    -- All code table IDs use string type to support both numeric PKs and GUIDs
    ----------------------------------------------------------------------------------------

    -- Dataset properties
    INSERT INTO 
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    VALUES 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array'),
            'indigenous_partnerships',
            'Indigenous Partnerships',
            'An array of indigenous partnership references.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array'),
            'stakeholder_partnerships',
            'Stakeholder Partnerships',
            'An array of stakeholder partnership names.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'first_nations_id',
            'First Nations ID',
            'Reference to a First Nations code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'site_strategy_id',
            'Site Strategy ID',
            'Reference to a site strategy code table entry.',
            false
        ),

    -- Sample Period properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'method_technique_id',
            'Method Technique ID',
            'Reference to a method technique table entry.',
            false
        ),

    -- Observation Environmental Condition properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'environment_qualitative_id',
            'Environment Qualitative ID',
            'Reference to an environment qualitative code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'environment_qualitative_option_id',
            'Environment Qualitative Option ID',
            'Reference to an environment qualitative option code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'environment_quantitative_id',
            'Environment Quantitative ID',
            'Reference to an environment quantitative code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number'),
            'environment_quantitative_value',
            'Environment Quantitative Value',
            'The numeric value for a quantitative environmental measurement.',
            false
        ),

    -- Sample Technique properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'method_lookup_id',
            'Method Lookup ID',
            'Reference to a method lookup code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'method_response_metric_id',
            'Method Response Metric ID',
            'Reference to a method response metric code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'attractant_lookup_id',
            'Attractant Lookup ID',
            'Reference to an attractant lookup code table entry.',
            false
        ),

    -- Sample Technique Detail properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'technique_attribute_qualitative_id',
            'Technique Attribute Qualitative ID',
            'Reference to a technique attribute qualitative code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'technique_attribute_qualitative_option_id',
            'Technique Attribute Qualitative Option ID',
            'Reference to a technique attribute qualitative option code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'technique_attribute_quantitative_id',
            'Technique Attribute Quantitative ID',
            'Reference to a technique attribute quantitative code table entry.',
            false
        ),

    -- Sample Technique Vantage properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'vantage_category_id',
            'Vantage Category ID',
            'Reference to a vantage category code table entry.',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'vantage_id',
            'Vantage ID',
            'Reference to a vantage code table entry.',
            false
        ),

    -- Species Observation properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'observation_sign_id',
            'Observation Sign ID',
            'Reference to an observation sign code table entry.',
            false
        ),

    -- Telemetry Device properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'device_make_id',
            'Device Make ID',
            'Reference to a device make code table entry.',
            false
        ),

    -- Telemetry Frequency properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'frequency_unit_id',
            'Frequency Unit ID',
            'Reference to a frequency unit code table entry.',
            false
        ),

    -- Habitat Feature properties
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'habitat_feature_type_id',
            'Habitat Feature Type ID',
            'Reference to a habitat feature type code table entry.',
            false
        );

    ----------------------------------------------------------------------------------------
    -- Link new properties to feature types
    ----------------------------------------------------------------------------------------

    INSERT INTO 
        feature_type_property (feature_type_id, feature_property_id, required_value)
    VALUES
        -- Dataset: indigenous_partnerships, stakeholder_partnerships
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships'),
            false
        ),

        -- Sample Period: method_technique_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'method_technique_id'),
            false
        ),

        -- Observation Environmental Condition: environment_qualitative_id, environment_qualitative_option_id, environment_quantitative_id, environment_quantitative_value
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'environment_qualitative_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'environment_qualitative_option_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'environment_quantitative_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'environment_quantitative_value'),
            false
        ),

        -- Sample Technique: method_lookup_id, method_response_metric_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'method_lookup_id'),
            true
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'method_response_metric_id'),
            true
        ),

        -- Sample Technique Detail: technique_attribute_qualitative_id, technique_attribute_qualitative_option_id, technique_attribute_quantitative_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_qualitative_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_qualitative_option_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_quantitative_id'),
            false
        ),

        -- Sample Technique Vantage: vantage_category_id, vantage_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_category_id'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_id'),
            false
        ),

        -- Species Observation: observation_sign_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'observation_sign_id'),
            false
        ),

        -- Telemetry Device: device_make_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'device_make_id'),
            true
        ),

        -- Telemetry Frequency: frequency_unit_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_frequency'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'frequency_unit_id'),
            false
        ),

        -- Habitat Feature: habitat_feature_type_id
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'habitat_feature_type_id'),
            true
        );

    ----------------------------------------------------------------------------------------
    -- Soft-delete old property-to-type links by setting record_end_date
    ----------------------------------------------------------------------------------------

    -- Dataset: partnerships (replaced by indigenous_partnerships + stakeholder_partnerships)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'partnerships')
    AND record_end_date IS NULL;

    -- Sample Period: sample_technique (replaced by method_technique_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sample_technique')
    AND record_end_date IS NULL;

    -- Observation Environmental Condition: environmental_condition (replaced by environment_qualitative_id/environment_quantitative_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition')
    AND record_end_date IS NULL;

    -- Observation Environmental Condition: environmental_condition_value (replaced by environment_qualitative_option_id/environment_quantitative_value)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition_value')
    AND record_end_date IS NULL;

    -- Sample Technique: method_name (replaced by method_lookup_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_name')
    AND record_end_date IS NULL;

    -- Sample Technique: response_metric (replaced by method_response_metric_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'response_metric')
    AND record_end_date IS NULL;

    -- Sample Technique Detail: method_attribute (replaced by technique_attribute_qualitative_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_attribute')
    AND record_end_date IS NULL;

    -- Sample Technique Detail: method_value (replaced by technique_attribute_qualitative_option_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_value')
    AND record_end_date IS NULL;

    -- Sample Technique Vantage: method_vantage (replaced by vantage_category_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_vantage')
    AND record_end_date IS NULL;

    -- Sample Technique Vantage: method_value (replaced by vantage_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_value')
    AND record_end_date IS NULL;

    -- Species Observation: sign (replaced by observation_sign_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sign')
    AND record_end_date IS NULL;

    -- Telemetry Device: device_manufacturer (replaced by device_make_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'device_manufacturer')
    AND record_end_date IS NULL;

    -- Telemetry Frequency: frequency_unit (replaced by frequency_unit_id)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_frequency')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'frequency_unit')
    AND record_end_date IS NULL;

    -- Habitat Feature: name (replaced by habitat_feature_type_id for the type reference)
    UPDATE feature_type_property
    SET record_end_date = now()
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'name')
    AND record_end_date IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Restore old property-to-type links by clearing record_end_date
    ----------------------------------------------------------------------------------------

    -- Habitat Feature: name
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'name')
    AND record_end_date IS NOT NULL;

    -- Telemetry Frequency: frequency_unit
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_frequency')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'frequency_unit')
    AND record_end_date IS NOT NULL;

    -- Telemetry Device: device_manufacturer
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'device_manufacturer')
    AND record_end_date IS NOT NULL;

    -- Species Observation: sign
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sign')
    AND record_end_date IS NOT NULL;

    -- Sample Technique Vantage: method_value
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_value')
    AND record_end_date IS NOT NULL;

    -- Sample Technique Vantage: method_vantage
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_vantage')
    AND record_end_date IS NOT NULL;

    -- Sample Technique Detail: method_value
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_value')
    AND record_end_date IS NOT NULL;

    -- Sample Technique Detail: method_attribute
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_attribute')
    AND record_end_date IS NOT NULL;

    -- Sample Technique: response_metric
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'response_metric')
    AND record_end_date IS NOT NULL;

    -- Sample Technique: method_name
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_name')
    AND record_end_date IS NOT NULL;

    -- Observation Environmental Condition: environmental_condition_value
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition_value')
    AND record_end_date IS NOT NULL;

    -- Observation Environmental Condition: environmental_condition
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition')
    AND record_end_date IS NOT NULL;

    -- Sample Period: sample_technique
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'sample_technique')
    AND record_end_date IS NOT NULL;

    -- Dataset: partnerships
    UPDATE feature_type_property
    SET record_end_date = NULL
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'partnerships')
    AND record_end_date IS NOT NULL;

    ----------------------------------------------------------------------------------------
    -- Remove new property-to-type links
    ----------------------------------------------------------------------------------------

    -- Habitat Feature: habitat_feature_type_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'habitat_feature_type_id');

    -- Telemetry Frequency: frequency_unit_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_frequency')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'frequency_unit_id');

    -- Telemetry Device: device_make_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'device_make_id');

    -- Species Observation: observation_sign_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'observation_sign_id');

    -- Sample Technique Vantage: vantage_id, vantage_category_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_vantage')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'vantage_category_id');

    -- Sample Technique Detail: technique_attribute_quantitative_id, technique_attribute_qualitative_option_id, technique_attribute_qualitative_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_quantitative_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_qualitative_option_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique_detail')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'technique_attribute_qualitative_id');

    -- Sample Technique: method_response_metric_id, method_lookup_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_response_metric_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_lookup_id');

    -- Observation Environmental Condition: environment_quantitative_value, environment_quantitative_id, environment_qualitative_option_id, environment_qualitative_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environment_quantitative_value');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environment_quantitative_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environment_qualitative_option_id');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'environment_qualitative_id');

    -- Sample Period: method_technique_id
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'method_technique_id');

    -- Dataset: stakeholder_partnerships, indigenous_partnerships
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships');

    ----------------------------------------------------------------------------------------
    -- Remove new feature properties
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_property WHERE name = 'habitat_feature_type_id';
    DELETE FROM feature_property WHERE name = 'frequency_unit_id';
    DELETE FROM feature_property WHERE name = 'device_make_id';
    DELETE FROM feature_property WHERE name = 'observation_sign_id';
    DELETE FROM feature_property WHERE name = 'vantage_id';
    DELETE FROM feature_property WHERE name = 'vantage_category_id';
    DELETE FROM feature_property WHERE name = 'technique_attribute_quantitative_id';
    DELETE FROM feature_property WHERE name = 'technique_attribute_qualitative_option_id';
    DELETE FROM feature_property WHERE name = 'technique_attribute_qualitative_id';
    DELETE FROM feature_property WHERE name = 'attractant_lookup_id';
    DELETE FROM feature_property WHERE name = 'method_response_metric_id';
    DELETE FROM feature_property WHERE name = 'method_lookup_id';
    DELETE FROM feature_property WHERE name = 'environment_quantitative_value';
    DELETE FROM feature_property WHERE name = 'environment_quantitative_id';
    DELETE FROM feature_property WHERE name = 'environment_qualitative_option_id';
    DELETE FROM feature_property WHERE name = 'environment_qualitative_id';
    DELETE FROM feature_property WHERE name = 'method_technique_id';
    DELETE FROM feature_property WHERE name = 'site_strategy_id';
    DELETE FROM feature_property WHERE name = 'first_nations_id';
    DELETE FROM feature_property WHERE name = 'stakeholder_partnerships';
    DELETE FROM feature_property WHERE name = 'indigenous_partnerships';

    ----------------------------------------------------------------------------------------
    -- Remove the categories feature type property relationship
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'codeset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'categories');

    ----------------------------------------------------------------------------------------
    -- Remove the categories feature property
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_property WHERE name = 'categories';

    ----------------------------------------------------------------------------------------
    -- Remove the codeset feature type
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type WHERE name = 'codeset';
  `);
}
