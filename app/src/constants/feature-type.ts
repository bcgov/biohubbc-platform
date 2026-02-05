import { mdiDatabase, mdiFileOutline, mdiMapMarker, mdiWifiMarker } from '@mdi/js';

/**
 * Significant feature types that are preferentially displayed in search results
 */
export enum PRIORITY_FEATURE_TYPE {
  DATASET = 'dataset',
  SPECIES_OBSERVATION = 'species_observation',
  TELEMETRY = 'telemetry',
  REPORT = 'report'
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
    label: 'Species observations',
    icon: mdiMapMarker
  },
  telemetry: {
    label: 'Telemetry',
    icon: mdiWifiMarker
  },
  report: {
    label: 'Report',
    icon: mdiFileOutline
  }
};
