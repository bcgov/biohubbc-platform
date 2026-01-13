import { Knex } from 'knex';

/**
 * Add codeset feature type
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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Remove the feature type property relationship
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type_property
    WHERE feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'codeset')
    AND feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'categories');

    ----------------------------------------------------------------------------------------
    -- Remove the feature property
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_property
    WHERE name = 'categories';

    ----------------------------------------------------------------------------------------
    -- Remove the feature type
    ----------------------------------------------------------------------------------------
    DELETE FROM feature_type
    WHERE name = 'codeset';
  `);
}
