import { MaterializedViewCommentMap } from '../types';

export const TELEMETRY_COMMENTS: MaterializedViewCommentMap = {
  Feature_ID: 'System generated surrogate primary key identifier',
  Latitude: 'The latitude of the GPS location',
  Longitude: 'The longitude of the GPS location',
  date: 'The date portion of the GPS location timestamp',
  time: 'The time portion of the GPS location timestamp',
  YEAR: 'The year that the GPS location was recorded',
  dop: 'The dilution of precision',
  device_key: 'The vendor and device serial',
  submission_id: 'Linked submission identifier for the feature',
  submission_name: 'Linked submission name for the feature',
  animal_id: 'The identifier of the animal wearing the telemetry device',
  scientific_name: 'Scientific name from taxon table linked via ITIS TSN',
  common_name: 'Common English name from taxon table linked via ITIS TSN',
  eco_unit:
    'Ecological unit type and value linked to the animal, formatted as type::value and concatenated with semicolons when multiple values exist',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)',
  source: 'A hyperlink to the source feature in the Biodiversity Hub portal'
};

export const OBSERVATIONS_COMMENTS: MaterializedViewCommentMap = {
  group_id:
    'Contributor-scoped observation identifier shared by species observations collected together, formatted as contributor_client_id::observation_id',
  Feature_ID: 'System generated surrogate primary key identifier for the species observation feature',
  date: 'The date portion of the observation timestamp',
  time: 'The time portion of the observation timestamp',
  YEAR: 'The year of the observation',
  Latitude: 'The latitude of the observation location',
  Longitude: 'The longitude of the observation location',
  sign: 'Type of sign associated with the observation',
  count: 'Count value for the observation',
  taxon_id: 'Taxonomic identifier extracted from the observation payload',
  scientific_name: 'Scientific name from taxon table linked via ITIS TSN',
  common_name: 'Common name from taxon table linked via ITIS TSN',
  submission_id: 'Linked submission identifier for the observation or subcount feature',
  submission_name: 'Linked submission name for the observation or subcount feature',
  sex: 'Sex label from contributor codeset codes (male, female, unknown) matched by contributor_codeset_code_id',
  life_stage:
    'Life stage label from contributor codeset codes (adult, juvenile, etc.) matched by contributor_codeset_code_id',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)',
  source: 'A hyperlink to the source feature in the Biodiversity Hub portal'
};
