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
    insert into feature_property_type (name, description, record_effective_date) values ('string',   'A string type',              now());
    insert into feature_property_type (name, description, record_effective_date) values ('number',   'A number type',              now());
    insert into feature_property_type (name, description, record_effective_date) values ('datetime', 'A datetime type (ISO 8601)', now());
    insert into feature_property_type (name, description, record_effective_date) values ('spatial',  'A spatial type',             now());
    insert into feature_property_type (name, description, record_effective_date) values ('boolean',  'A boolean type',             now());
    insert into feature_property_type (name, description, record_effective_date) values ('object',   'An object type',             now());
    insert into feature_property_type (name, description, record_effective_date) values ('array',    'An array type',              now());

    -- populate feature_property table
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('name',        'Name',        'The name of the record',                   (select feature_property_type_id from feature_property_type where name = 'string'),   null,                                                                         now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('description', 'Description', 'The description of the record',            (select feature_property_type_id from feature_property_type where name = 'string'),   null,                                                                         now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('taxonomy',    'Taxonomy Id', 'The taxonomy Id associated to the record', (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('date_range',  'Date Range',  'A date range',                             (select feature_property_type_id from feature_property_type where name = 'object'),   null,                                                                         now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('start_date',  'Start Date',  'The start date of the record',             (select feature_property_type_id from feature_property_type where name = 'datetime'), (select feature_property_id from feature_property where name = 'date_range'), now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('end_date',    'End Date',    'The end date of the record',               (select feature_property_type_id from feature_property_type where name = 'datetime'), (select feature_property_id from feature_property where name = 'date_range'), now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('geometry',    'Geometry',    'The location of the record',               (select feature_property_type_id from feature_property_type where name = 'spatial'),  null,                                                                         now());
    insert into feature_property (name, display_name, description, feature_property_type_id, parent_feature_property_id, record_effective_date) values ('count',       'Count',       'The count of the record',                  (select feature_property_type_id from feature_property_type where name = 'number'),   null,                                                                         now());

    -- populate feature_type table
    insert into feature_type (name, display_name, description, record_effective_date) values ('dataset',       'Dataset',       'A related collection of data (ie: survey)',     now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('sample_site',   'Sample Site',   'A location at which data was collected',        now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('sample_method', 'Sample Method', 'A method used to collect data',                 now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('sample_period', 'Sample Period', 'A datetime period in which data was collected', now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('observation',   'Observation',   'An observation record',                         now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('animal',        'Animal',        'An individual animal record',                   now());
    insert into feature_type (name, display_name, description, record_effective_date) values ('telemetry',     'Telemetry',     'A telemetry record',                            now());

    -- populate feature_type_property table
    -- feature_type: dataset
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'name'),        now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'description'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'taxonomy'),    now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'date_range'),  now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'start_date'),  now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'end_date'),    now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'dataset'), (select feature_property_id from feature_property where name = 'geometry'),    now());

    -- feature_type: sample_site
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'name'),        now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'description'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_site'), (select feature_property_id from feature_property where name = 'geometry'),    now());

    -- feature_type: sample_method
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_method'), (select feature_property_id from feature_property where name = 'name'),        now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_method'), (select feature_property_id from feature_property where name = 'description'), now());

    -- feature_type: sample_period
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'date_range'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'start_date'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'sample_period'), (select feature_property_id from feature_property where name = 'end_date'),   now());

    -- feature_type: observation
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'taxonomy'),   now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'date_range'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'start_date'), now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'end_date'),   now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'geometry'),   now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'observation'), (select feature_property_id from feature_property where name = 'count'),      now());

    -- feature_type: animal
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'animal'), (select feature_property_id from feature_property where name = 'taxonomy'), now());

    -- feature_type: telemetry
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'date_range'),  now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'start_date'),  now());
    insert into feature_type_property (feature_type_id, feature_property_id, record_effective_date) values ((select feature_type_id from feature_type where name = 'telemetry'), (select feature_property_id from feature_property where name = 'end_date'),    now());
  `);
}
