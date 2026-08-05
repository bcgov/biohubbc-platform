import { MaterializedViewCommentMap } from '../types';

export const TELEMETRY_COMMENTS: MaterializedViewCommentMap = {
  Feature_ID: 'System generated surrogate primary key identifier',
  taxon_id: 'Taxonomic identifier of the observed species',
  scientific_name: 'Scientific name of the observed species',
  common_name: 'Common name of the observed species',
  animal_id: 'The identifier of the animal wearing the telemetry device',
  sex: 'Sex label from contributor codeset',
  eco_unit: 'Ecological unit type and value linked to the animal',
  device_key: 'The vendor and device serial',
  date: 'The date portion of the GPS location timestamp',
  time: 'The time portion of the GPS location timestamp',
  YEAR: 'The year that the GPS location was recorded',
  Latitude: 'The latitude of the GPS location',
  Longitude: 'The longitude of the GPS location',
  dop: 'The dilution of precision of the GPS location',
  submission_id: 'Submission identifier under which the feature was submitted',
  submission_name: 'Submission name under which the feature was submitted',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)',
  source: 'A hyperlink to the source feature in the Biodiversity Hub portal'
};

export const OBSERVATIONS_COMMENTS: MaterializedViewCommentMap = {
  Feature_ID: 'System generated surrogate primary key identifier',
  taxon_id: 'Taxonomic identifier of the observed species',
  scientific_name: 'Scientific name of the observed species',
  common_name: 'Common name of the observed species',
  sign: 'Sign used to make the observation',
  group_id: 'Group identifier shared by species observations collected together',
  sex: 'Sex label from contributor codeset',
  life_stage: 'Life stage label from contributor codeset',
  count: 'Count value for the observation',
  date: 'The date portion of the observation timestamp',
  time: 'The time portion of the observation timestamp',
  YEAR: 'The year of the observation',
  Latitude: 'The latitude of the observation location',
  Longitude: 'The longitude of the observation location',
  submission_id: 'Submission identifier under which the feature was submitted',
  submission_name: 'Submission name under which the feature was submitted',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)',
  source: 'A hyperlink to the source feature in the Biodiversity Hub portal'
};
