import { MaterializedViewCommentMap } from '../types';

export const TELEMETRY_COMMENTS: MaterializedViewCommentMap = {
  Feature_ID: 'System generated surrogate primary key identifier',
  Latitude: 'The latitude of the GPS location',
  Longitude: 'The longitude of the GPS location',
  DATETIME: 'The date and time that the GPS location was recorded',
  YEAR: 'The year that the GPS location was recorded',
  dop: 'The dilution of precision',
  device_key: 'The vendor and device serial',
  dataset_id: 'The feature id of the dataset that includes these data',
  dataset_name: 'The dataset name that includes these data',
  animal_id: 'The identifier of the animal wearing the telemetry device',
  scientific_name: 'Scientific name from taxon table linked via ITIS TSN',
  common_name: 'Common English name from taxon table linked via ITIS TSN',
  pop_unit: 'Ecological unit value linked to the animal',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)'
};

export const OBSERVATIONS_COMMENTS: MaterializedViewCommentMap = {
  observation_id: 'Parent observation feature_id; multiple rows if observation has subcounts',
  observation_subcount_id: 'Subcount observation_feature_id; NULL if observation has no subcounts',
  Feature_ID: 'System generated surrogate primary key identifier (subcount or observation feature_id)',
  Latitude: 'The latitude of the observation location',
  Longitude: 'The longitude of the observation location',
  DATETIME: 'The timestamp of the observation',
  YEAR: 'The year of the observation',
  sign: 'Type of sign associated with the observation',
  count: 'Count value for the observation',
  taxon_id: 'Taxonomic identifier extracted from the observation payload',
  scientific_name: 'Scientific name from taxon table linked via ITIS TSN',
  common_name: 'Common name from taxon table linked via ITIS TSN',
  dataset_id: 'Linked dataset submission_feature_id for the observation',
  dataset_name: 'Linked dataset name for the observation',
  sex: 'Sex label from contributor codeset codes (male, female, unknown) matched by contributor_codeset_code_id',
  life_stage:
    'Life stage label from contributor codeset codes (adult, juvenile, etc.) matched by contributor_codeset_code_id',
  SECURED: 'The indicator of whether the feature is secured (Y) or not (N)'
};
