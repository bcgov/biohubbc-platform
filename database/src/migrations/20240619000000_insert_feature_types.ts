import { Knex } from 'knex';

/**
 * Insert new feature types
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    set search_path=biohub,public;

    ----------------------------------------------------------------------------------------
    -- Insert feature types
    ----------------------------------------------------------------------------------------
    INSERT INTO feature_type (name, display_name, description)
    VALUES 
        (
            'dataset',
            'Dataset',
            'A related collection of data.'
        ),
        (
            'file',
            'File',
            'A file such as an image or document.'
        ),
        (
            'sample_site',
            'Sampling site',
            'A location where species observations are collected.'
        ),
        (
            'sample_method',
            'Sampling method',
            'A method by which species observations or other ecological data are collected.'
        ),
        (
            'sample_period',
            'Sampling period',
            'A time period in which a sampling method is conducted.'
        ),
        (
            'species_observation',
            'Species observation',
            'Information about an encounter with a species or evidence of a species, such as hair or tracks.'
        ),
        (
            'animal',
            'Animal',
            'An individual animal.'
        ),
        (
            'telemetry',
            'Telemetry',
            'Positional data from a telemetry device.'
        ),
        (
            'telemetry_deployment',
            'Telemetry deployment',
            'Metadata describing the deployment of a telemetry device.'
        ),
        (
            'capture',
            'Capture',
            'Information about an animal capture event.'
        ),
        (
            'mortality',
            'Mortality',
            'Information about an animal mortality event.'
        ),
        (
            'measurement',
            'Measurement',
            'Information about a species measurement, such as body condition or length.'
        ),
        (
            'marking',
            'Marking',
            'Information about a marking applied to an animal for identification.'
        ),
        (
            'ecological_unit',
            'Ecological unit',
            'An ecological unit, such as a population unit, herd, or pack.'
         ),
        (
            'study_area',
            'Study Area',
            'The location where this study took place.'
        ),
        (
            'release',
            'Release',
            'Information about an animal release event.'
        ),
        (
            'report',
            'Report',
            'A structured document presenting information, findings, or analysis.'
        );


    ----------------------------------------------------------------------------------------
    -- Insert feature property types
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property_type (name, description)
    VALUES 
        ('string', 'A string type'),
        ('number', 'A number type'),
        ('datetime', 'A datetime type (ISO 8601)'),
        ('spatial', 'A spatial type'),
        ('boolean', 'A boolean type'),
        ('object', 'An object type'),
        ('array', 'An array type'),
        ('artifact_key', 'An artifact key type (string)');

    ----------------------------------------------------------------------------------------
    -- Insert feature properties
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    VALUES 
        -- COMMON PROPERTIES
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),  
            'name', 
            'Name', 
            'The name of the record.', 
            false
        ),
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'description',
            'Description',
            'The description of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number'),
            'taxon_id',
            'Taxonomic identifier',
            'The unique identifier of the species associated to the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'scientific_name',
            'Scientific name',
            'The scientific name of the species associated to the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'object'),
            'date_range',
            'Date Range',
            'A date range.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'datetime'),
            'start_date',
            'Start Date',
            'The start date of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'datetime'),
            'end_date',
            'End Date',
            'The end date of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'datetime'),
            'timestamp',
            'Timestamp',
            'The timestamp of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'spatial'),
            'geometry',
            'Geometry',
            'The location of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number'),
            'count',
            'Count',
            'The count of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number'),
            'latitude',
            'Latitude',
            'The latitude of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'number'),
            'longitude',
            'Longitude',
            'The longitude of the record.',
            false
        ), 
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'artifact_key'),
            'artifact_key',
            'Key',
            'The S3 storage key for an artifact',
            true
        ),
         (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'identifier',
            'Identifier',
            'Identifier of the record from an external source system.',
            false
            
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'animal_identifier',
            'Animal identifier',
            'Identifier of the animal.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'boolean'),
            'proprietary_information',
            'Proprietary Information',
            'Does this record contain proprietary information.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'partnership',
            'Partnership',
            'Name of the collaborative project or data-sharing partnership.',
            false
        ),
        -- TELEMETRY-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'elevation',
            'Elevation',
            'The elevation (z-axis) of an observation.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'dop',
            'Dilution of Precision',
            'The dilution of precision (DOP) of an observation.',
            false
        ),
        -- DEVICE DEPLOYMENT-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'device_manufacturer',
            'Device manufacturer',
            'Manufacturer of the device.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'device_model',
            'Device model',
            'Model of the device.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'frequency',
            'Frequency',
            'Frequency of the device.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'fix_rate',
            'Fix rate',
            'Rate at which the device records a location.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'frequency_unit',
            'Frequency Unit',
            'Unit of frequency of the device.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'fix_rate_unit',
            'Fix rate unit',
            'Unit of the rate at which the device records a location.',
            false
        ),
    -- CAPTURE-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'date',
            'Date',
            'A date.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'time',
            'Time',
            'A time of day.',
            false
        ),
    -- MEASUREMENT-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'measurement_type',
            'Measurement',
            'The type of measurement.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'measurement_value',
            'Measurement value',
            'The value of the measurement.',
            false
        ),
    -- MARKING-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'colour',
            'Colour',
            'The colour of a marking on an animal.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'body_position',
            'Body position',
            'The location of a marking on an animal',
            false
        ),
    -- REPORT-RELATED PROPERTIES 
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'year',
            'Year',
            'The year that the report was finished or published.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'author',
            'Author',
            'The author(s) of the report.',
            false
        ),
    -- ECOLOGICAL UNIT-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'ecological_unit_type',
            'Ecological unit',
            'The ecological unit type or category, such as population unit, herd, or pack.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'ecological_unit_value',
            'Ecological unit value',
            'The value of the ecological unit type, like the name of a specific population unit if the type is population unit.',
            false
        );


----------------------------------------------------------------------------------------
-- Assign feature properties to feature types
----------------------------------------------------------------------------------------
INSERT INTO 
    feature_type_property (feature_type_id, feature_property_id, required_value)
VALUES
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'start_date'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'end_date'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'proprietary_information'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'partnership'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'file'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'artifact_key'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'report'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'artifact_key'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'report'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'report'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'year'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'report'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'report'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'author'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_method'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_method'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'start_date'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'end_date'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_site'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_site'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_site'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'study_area'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'study_area'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'animal_identifier'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'start_date'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'start_time'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'device_manufacturer'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'device_model'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'frequency'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'frequency_unit'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'fix_rate'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'fix_rate_unit'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'animal'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'taxon_id'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'animal'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'animal_identifier'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'animal'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'capture'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'capture'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'capture'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'capture'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'release'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'release'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'release'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'release'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'mortality'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'mortality'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'mortality'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'mortality'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'taxon_id'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'animal_identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'latitude'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'longitude'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'elevation'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'dop'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'measurement'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'measurement'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'measurement_type'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'measurement'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'measurement_value'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'marking'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'body_position'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'marking'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'identifier'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'marking'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'colour'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'ecological_unit'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'ecological_unit_type'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'ecological_unit'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'ecological_unit_value'),
        false
    );

  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
