import { Knex } from 'knex';

/**
 * Populate tables:
 * - feature_property_type
 * - feature_property
 * - feature_type
 * - feature_type_property
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.raw(`
    ----------------------------------------------------------------------------------------
    -- Create tables
    ----------------------------------------------------------------------------------------
    set search_path=biohub,public;

    -- populate feature_property_type table
    insert into feature_property_type (name, description, record_effective_date) values ('string',   'A string type',              now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('number',   'A number type',              now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('datetime', 'A datetime type (ISO 8601)', now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('spatial',  'A spatial type',             now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('boolean',  'A boolean type',             now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('object',   'An object type',             now()) ON CONFLICT DO NOTHING;
    insert into feature_property_type (name, description, record_effective_date) values ('array',    'An array type',              now()) ON CONFLICT DO NOTHING;

    -- populate feature_property table
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('name',        'Name',        'The name of the record',                   (select feature_property_type_id from feature_property_type where name = 'string'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('description', 'Description', 'The description of the record',            (select feature_property_type_id from feature_property_type where name = 'string'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('taxonomy',    'Taxonomy Id', 'The taxonomy Id associated to the record', (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('date_range',  'Date Range',  'A date range',                             (select feature_property_type_id from feature_property_type where name = 'object'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('start_date',  'Start Date',  'The start date of the record',             (select feature_property_type_id from feature_property_type where name = 'datetime'), (select feature_property_id from feature_property where name = 'date_range'), now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('end_date',    'End Date',    'The end date of the record',               (select feature_property_type_id from feature_property_type where name = 'datetime'), (select feature_property_id from feature_property where name = 'date_range'), now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('timestamp',   'Timestamp',   'The timestamp of the record',              (select feature_property_type_id from feature_property_type where name = 'datetime'), null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('geometry',    'Geometry',    'The location of the record',               (select feature_property_type_id from feature_property_type where name = 'spatial'),  null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('count',       'Count',       'The count of the record',                  (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('latitude',    'Latitude',    'The latitude of the record',               (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('longitude',   'Longitude',   'The longitude of the record',              (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now()) ON CONFLICT DO NOTHING;
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('s3_key',      'Key',         'The S3 storage key for an artifact',       (select feature_property_type_id from feature_property_type where name = 'string'),   null,                                                                         now()) ON CONFLICT DO NOTHING;

    -- populate feature_type table
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('dataset',       'Datasets',       'A related collection of data (ie: survey)',     1, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('artifact',      'Artifacts',      'An artifact (ie: image, document, pdf)',        2, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('sample_site',   'Sample Sites',   'A location at which data was collected',        3, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('sample_method', 'Sample Methods', 'A method used to collect data',                 4, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('sample_period', 'Sample Periods', 'A datetime period in which data was collected', 5, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('observation',   'Observations',   'An observation record',                         6, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('animal',        'Animals',        'An individual animal record',                   7, now()) ON CONFLICT DO NOTHING;
    insert into feature_type (name, display_name, description, sort, record_effective_date) values ('telemetry',     'Telemetry',      'A telemetry record',                            8, now()) ON CONFLICT DO NOTHING;

    -- populate feature_type_property table
    -- feature_type: dataset
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'name'),        1, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'description'), 2, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'taxonomy'),    3, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'date_range'),  4, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'start_date'),  5, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'end_date'),    6, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'geometry'),    7, now()) ON CONFLICT DO NOTHING;

    -- feature_type: artifact
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'artifact'), (select feature_property_id from feature_property where name = 's3_key'), 1, now()) ON CONFLICT DO NOTHING;

    -- feature_type: sample_site
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'name'),        1, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'description'), 2, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'geometry'),    3, now()) ON CONFLICT DO NOTHING;

    -- feature_type: sample_method
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_method'), (select feature_property_id from feature_property where name = 'name'),        1, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_method'), (select feature_property_id from feature_property where name = 'description'), 2, now()) ON CONFLICT DO NOTHING;

    -- feature_type: sample_period
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'date_range'), 1, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'start_date'), 2, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'end_date'),   3, now()) ON CONFLICT DO NOTHING;

    -- feature_type: observation
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'taxonomy'),   1, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'date_range'), 1, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'start_date'), 2, now()) ON CONFLICT DO NOTHING;
    -- insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'end_date'),   3, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'geometry'),   7, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'latitude'),   5, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'longitude'),  6, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'count'),      4, now()) ON CONFLICT DO NOTHING;

    -- feature_type: animal
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'animal'), (select feature_property_id from feature_property where name = 'taxonomy'), 1, now()) ON CONFLICT DO NOTHING;

    -- feature_type: telemetry
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'date_range'), 1, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'start_date'), 2, now()) ON CONFLICT DO NOTHING;
    insert into feature_type_property (feature_type_id, feature_property_id, sort, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'end_date'),   3, now()) ON CONFLICT DO NOTHING;
  `);
}
