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
 * Inserts are idempotent (WHERE NOT EXISTS) so the migration can be re-run safely
 * after a pg_restore without duplicate key errors.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Insert codeset feature type (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type (name, display_name, description)
    SELECT 'codeset', 'Codeset', 'A code table containing standardized categories and code values.'
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_type
        WHERE name = 'codeset' AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- Insert categories feature property (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT
        (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'object' AND record_end_date IS NULL),
        'categories',
        'Categories',
        'An object of categories, each containing standardized code values.',
        false
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_property
        WHERE name = 'categories' AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- Link categories property to codeset feature type (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO
        feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
        (SELECT feature_type_id FROM feature_type WHERE name = 'codeset' AND record_end_date IS NULL),
        (SELECT feature_property_id FROM feature_property WHERE name = 'categories' AND record_end_date IS NULL),
        true
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_type_property ftp
        WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'codeset' AND record_end_date IS NULL)
          AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'categories' AND record_end_date IS NULL)
          AND ftp.record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- Insert partnership properties for dataset feature type (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array' AND record_end_date IS NULL),
           'indigenous_partnerships',
           'Indigenous Partnerships',
           'An array of indigenous partnerships',
           false
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_property
        WHERE name = 'indigenous_partnerships' AND record_end_date IS NULL
    );

    INSERT INTO
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    SELECT (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'array' AND record_end_date IS NULL),
           'stakeholder_partnerships',
           'Stakeholder Partnerships',
           'An array of stakeholder partnerships',
           false
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_property
        WHERE name = 'stakeholder_partnerships' AND record_end_date IS NULL
    );

    ----------------------------------------------------------------------------------------
    -- Link partnership properties to dataset feature type (idempotent)
    ----------------------------------------------------------------------------------------
    INSERT INTO
        feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' AND record_end_date IS NULL),
        (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships' AND record_end_date IS NULL),
        false
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_type_property ftp
        WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' AND record_end_date IS NULL)
          AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'indigenous_partnerships' AND record_end_date IS NULL)
          AND ftp.record_end_date IS NULL
    );

    INSERT INTO
        feature_type_property (feature_type_id, feature_property_id, required_value)
    SELECT
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' AND record_end_date IS NULL),
        (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships' AND record_end_date IS NULL),
        false
    WHERE NOT EXISTS (
        SELECT 1 FROM feature_type_property ftp
        WHERE ftp.feature_type_id = (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' AND record_end_date IS NULL)
          AND ftp.feature_property_id = (SELECT feature_property_id FROM feature_property WHERE name = 'stakeholder_partnerships' AND record_end_date IS NULL)
          AND ftp.record_end_date IS NULL
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
