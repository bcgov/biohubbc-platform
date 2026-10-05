import { mdiDatabase, mdiFileOutline, mdiMapMarker, mdiTerrain, mdiWifiMarker } from '@mdi/js';

/**
 * Feature types supported by BioHub, including historical types retained for existing submissions.
 */
export enum FEATURE_TYPE {
  ANIMAL = 'animal',
  BLOCK = 'block',
  CAPTURE = 'capture',
  CODESET = 'codeset',
  DATASET = 'dataset',
  ECOLOGICAL_UNIT = 'ecological_unit',
  FILE = 'file',
  HABITAT_FEATURE = 'habitat_feature',
  MARKING = 'marking',
  MEASUREMENT = 'measurement',
  MORTALITY = 'mortality',
  OBSERVATION_ENVIRONMENTAL_CONDITION = 'observation_environmental_condition',
  OBSERVATION_SUBCOUNT = 'observation_subcount',
  OBSERVATION_SUBCOUNT_MEASUREMENT = 'observation_subcount_measurement',
  RELEASE = 'release',
  REPORT = 'report',
  SAMPLE_PERIOD = 'sample_period',
  SAMPLE_SITE = 'sample_site',
  SAMPLE_TECHNIQUE = 'sample_technique',
  SAMPLE_TECHNIQUE_DETAIL = 'sample_technique_detail',
  SAMPLE_TECHNIQUE_VANTAGE = 'sample_technique_vantage',
  SPECIES_OBSERVATION = 'species_observation',
  STRATUM = 'stratum',
  STUDY_AREA = 'study_area',
  SURVEY = 'survey',
  TELEMETRY = 'telemetry',
  TELEMETRY_DEPLOYMENT = 'telemetry_deployment',
  TELEMETRY_DEVICE = 'telemetry_device',
  TELEMETRY_FREQUENCY = 'telemetry_frequency'
}

/**
 * Significant feature types that are preferentially displayed in search results
 */
export enum PRIORITY_FEATURE_TYPE {
  SURVEY = 'survey',
  SPECIES_OBSERVATION = 'species_observation',
  TELEMETRY = 'telemetry',
  REPORT = 'report',
  HABITAT_FEATURE = 'habitat_feature'
}

/**
 * Display labels and icons for feature types
 */
export const FEATURE_TYPE_CONFIG: Record<PRIORITY_FEATURE_TYPE, { label: string; icon: string }> = {
  survey: {
    label: 'Surveys',
    icon: mdiDatabase
  },
  species_observation: {
    label: 'Observations',
    icon: mdiMapMarker
  },
  telemetry: {
    label: 'Telemetry',
    icon: mdiWifiMarker
  },
  report: {
    label: 'Reports',
    icon: mdiFileOutline
  },
  habitat_feature: {
    label: 'Habitat Features',
    icon: mdiTerrain
  }
};

/**
 * Singular display labels for all supported feature types.
 */
export const FEATURE_TYPE_DISPLAY_LABEL: Record<FEATURE_TYPE, string> = {
  animal: 'Animal',
  block: 'Block',
  capture: 'Capture',
  codeset: 'Codeset',
  dataset: 'Dataset',
  ecological_unit: 'Ecological Unit',
  file: 'File',
  habitat_feature: 'Habitat Feature',
  marking: 'Marking',
  measurement: 'Measurement',
  mortality: 'Mortality',
  observation_environmental_condition: 'Observation Environmental Condition',
  observation_subcount: 'Observation Subcount',
  observation_subcount_measurement: 'Observation Subcount Measurement',
  release: 'Release',
  report: 'Report',
  sample_period: 'Sampling Period',
  sample_site: 'Sampling Site',
  sample_technique: 'Sampling Technique',
  sample_technique_detail: 'Sampling Technique Detail',
  sample_technique_vantage: 'Sampling Technique Vantage',
  species_observation: 'Species Observation',
  stratum: 'Stratum',
  study_area: 'Study Area',
  survey: 'Survey',
  telemetry: 'Telemetry',
  telemetry_deployment: 'Telemetry Deployment',
  telemetry_device: 'Telemetry Device',
  telemetry_frequency: 'Telemetry Frequency'
};
