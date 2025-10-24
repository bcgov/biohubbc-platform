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
            'animal',
            'Animal',
            'An individual animal.'
        ),
        (
            'capture',
            'Capture',
            'Information about an animal capture event.'
        ),
        (
            'dataset',
            'Dataset',
            'A related collection of data.'
        ),
        (
            'ecological_unit',
            'Ecological unit',
            'An ecological unit, such as a population unit, herd, or pack.'
        ),
        (
            'file',
            'File',
            'A file such as an image or document.'
        ),
        (
            'habitat_feature',
            'Habitat feature',
            'Information about a habitat feature.'
        ),
        (
            'image',
            'Image',
            'An image file'
        ),
        (
            'marking',
            'Marking',
            'Information about a marking applied to an animal for identification.'
        ),
        (
            'measurement',
            'Measurement',
            'Information about a species measurement, such as body condition or length.'
        ),
        (
            'mortality',
            'Mortality',
            'Information about an animal mortality event.'
        ),
        (
            'observation_subcount',
            'Observation subcount',
            'Information about an observation subcount.'
        ),
        (
            'observation_environmental_condition',
            'Observation environmental condition',
            'Information about an observation environmental condition.'
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
        ),
        (
            'sample_period',
            'Sampling period',
            'A time period in which sampling is conducted.'
        ),
        (
            'sample_site',
            'Sampling site',
            'A location where species observations are collected.'
        ),
        (
            'sample_technique',
            'Sampling technique',
            'A technique by which species observations or other ecological data are collected.'
        ),
        (
            'species_observation',
            'Species observation',
            'Information about an encounter with a species or evidence of a species, such as hair or tracks.'
        ),
        (
            'stratum',
            'Stratum',
            'A stratum.'
        ),
        (
            'study_area',
            'Study Area',
            'The location where this study took place.'
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
            'telemetry_device',
            'Telemetry device',
            'A telemetry device.'
        );


    ----------------------------------------------------------------------------------------
    -- Insert feature property types
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property_type (name, description)
    VALUES 
        ('array', 'An array type'),
        ('artifact_key', 'An artifact key type (string)'),
        ('boolean', 'A boolean type'),
        ('datetime', 'A datetime type (ISO 8601)'),
        ('number', 'A number type'),
        ('object', 'An object type'),
        ('spatial', 'A spatial type'),
        ('string', 'A string type');

    ----------------------------------------------------------------------------------------
    -- Insert feature properties
    ----------------------------------------------------------------------------------------
    INSERT INTO 
        feature_property (feature_property_type_id, name, display_name, description, calculated_value)
    VALUES 
        -- COMMON PROPERTIES
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),  
            'guid', 
            'GUID', 
            'The globally unique identifier for the record.', 
            false
        ),
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
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'comment',
            'Comment',
            'A comment about the record.',
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
            'The S3 storage key for an artifact.',
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
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'site_identifier',
            'Site identifier',
            'Identifier of the site.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'sex',
            'Sex',
            'The biological sex of an organism.',
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
            'partnerships',
            'Partnerships',
            'Name of the collaborative project or data-sharing partnerships.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'site_select_strategy',
            'Site selection strategy',
            'The tactic employed when determining site locations.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'eco_variables',
            'Ecological Variables',
            'The key ecological aspect(s) that the study aims to assess.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'collected_data',
            'Collected Data',
            'The data collected from the study.',
            false
        ),
        -- TECHNIQUE-RELATED PROPERTIES 
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'attractant',
            'Attractants',
            'Attractants employed under your sampling technique that entice or encourage observations.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'method_attribute',
            'Method Attributes',
            'Key characteristics or details of the method used in this data collection.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'method_vantage',
            'Method Vantage',
            'The vantage point from which the method is employed.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'method_name',
            'Method Name',
            'The name of the method used in this data collection.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'response_metric',
            'Response Metric',
            'The metric of the response of the method used in this data collection.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'number'),
            'detect_distance',
            'Detection Distance',
            'The maximum distance at which an observation can be made while employing this technique.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'sample_technique',
            'Sample Technique',
            'The technique used to sample the data.',
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
            'device',
            'Device',
            'The device associated with the telemetry deployment.',
            false
        ),
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
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'serial_number',
            'Serial number',
            'Serial number of the device.',
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
            'The location of a marking on an animal.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'marking_type',
            'Marking Type',
            'The nature of the marking on the animal.',
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
        (
            (SELECT feature_property_type_id FROM feature_property_type WHERE name = 'string'),
            'file_type',
            'File Type',
            'The type of file.',
            true
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
        ),
    -- MORTALITY-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'cause_of_death',
            'Cause of death',
            'The cause of death of the animal.',
            false
        ),
    -- SPECIES OBSERVATION-RELATED PROPERTIES
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'environmental_condition',
            'Environmental condition',
            'The environmental condition of the species observation.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'environmental_condition_value',
            'Environmental condition value',
            'The value of the environmental condition of the species observation.',
            false
        ),
        (
            (SELECT feature_property_type_id from feature_property_type where name = 'string'),
            'sign',
            'Sign',
            'The sign of the species observation.',
            false
        );

----------------------------------------------------------------------------------------
-- Assign feature properties to feature types
----------------------------------------------------------------------------------------
INSERT INTO 
    feature_type_property (feature_type_id, feature_property_id, required_value)
VALUES
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'animal'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'sex'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
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
        (SELECT feature_property_id FROM feature_property WHERE name = 'partnerships'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'site_select_strategy'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'eco_variables'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'collected_data'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'taxon_id'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'guid'),
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
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'file'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'artifact_key'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'file'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'file'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'file'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'file_type'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'count'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'timestamp'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'taxon_id'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'habitat_feature'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'image'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'artifact_key'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'image'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'image'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'image'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'file_type'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'marking'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'marking_type'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'marking'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'mortality'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'cause_of_death'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_environmental_condition'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'environmental_condition_value'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'measurement_type'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'measurement_value'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'comment'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'observation_subcount'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'count'),
        true
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'site_identifier'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_period'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'sample_technique'),
        false
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'attractant'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'method_attribute'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'response_metric'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'method_vantage'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'method_name'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'sample_technique'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'detect_distance'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'taxon_id'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'species_observation'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'sign'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'study_area'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'stratum'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'name'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'stratum'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'geometry'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'animal_identifier'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'device'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'start_date'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_deployment'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'end_date'),
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
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'device_manufacturer'),
        true
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'device_model'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'description'),
        false
    ),
    (
        (SELECT feature_type_id FROM feature_type WHERE name = 'telemetry_device'),
        (SELECT feature_property_id FROM feature_property WHERE name = 'serial_number'),
        true
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
