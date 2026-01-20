import { Knex } from 'knex';

/**
 * Add codeset feature type to support the new SIMS payload format.
 *
 * This migration:
 * 1. Adds the 'codeset' feature type with 'categories' property (as object)
 * 2. Adds partnership properties for dataset feature type (indigenous_partnerships, stakeholder_partnerships)
 *
 * Note: Property names remain unchanged - existing properties will now receive values
 * in the format 'code::{table_name}::{id}' instead of plain string values.
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
        (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'object'),
        'categories',
        'Categories',
        'An object of categories, each containing standardized code values.',
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
    -- Insert partnership properties for dataset feature type
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    VALUES 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array'),
            'indigenous_partnerships',
            'Indigenous Partnerships',
            'An array of indigenous partnerships',
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array'),
            'stakeholder_partnerships',
            'Stakeholder Partnerships',
            'An array of stakeholder partnerships',
            false
        );

    ----------------------------------------------------------------------------------------
    -- Link partnership properties to dataset feature type
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_type_property (feature_type_id, feature_property_id, required_value)
    VALUES
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships'),
            false
        ),
        (
            (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
            (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships'),
            false
        );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Remove partnership property-to-type links
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships');

    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships');

    ----------------------------------------------------------------------------------------
    -- Remove partnership feature properties
    ----------------------------------------------------------------------------------------
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
