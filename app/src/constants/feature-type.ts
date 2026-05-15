import { mdiDatabase, mdiFileOutline, mdiMapMarker, mdiTerrain, mdiWifiMarker } from '@mdi/js';

/**
 * Significant feature types that are preferentially displayed in search results
 */
export enum PRIORITY_FEATURE_TYPE {
  DATASET = 'dataset',
  SPECIES_OBSERVATION = 'species_observation',
  TELEMETRY = 'telemetry',
  REPORT = 'report',
  HABITAT_FEATURE = 'habitat_feature'
}

/**
 * Display labels and icons for feature types
 */
export const FEATURE_TYPE_CONFIG: Record<PRIORITY_FEATURE_TYPE, { label: string; icon: string }> = {
  dataset: {
    label: 'Datasets',
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
