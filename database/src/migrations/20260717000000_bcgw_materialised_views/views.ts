import { buildViewSQL } from './build-view-sql';
import { OBSERVATION_COLUMNS, OBSERVATION_COMMENTS, OBSERVATION_QUERY } from './observation';
import { TELEMETRY_COLUMNS, TELEMETRY_COMMENTS, TELEMETRY_QUERY } from './telemetry';
import { MaterialisedViewName } from './types';

export const VIEW_SQL = [
  {
    name: 'wld_observations_public',
    sql: buildViewSQL('wld_observations_public', OBSERVATION_QUERY, OBSERVATION_COLUMNS, true, 'linked'),
    comments: OBSERVATION_COMMENTS
  },
  {
    name: 'wld_observations_all',
    sql: buildViewSQL('wld_observations_all', OBSERVATION_QUERY, OBSERVATION_COLUMNS, false, 'linked'),
    comments: OBSERVATION_COMMENTS
  },
  {
    name: 'wld_telemetry_public',
    sql: buildViewSQL('wld_telemetry_public', TELEMETRY_QUERY, TELEMETRY_COLUMNS, true),
    comments: TELEMETRY_COMMENTS
  },
  {
    name: 'wld_telemetry_all',
    sql: buildViewSQL('wld_telemetry_all', TELEMETRY_QUERY, TELEMETRY_COLUMNS, false),
    comments: TELEMETRY_COMMENTS
  },
  {
    name: 'wld_incidental_public',
    sql: buildViewSQL('wld_incidental_public', OBSERVATION_QUERY, OBSERVATION_COLUMNS, true, 'incidental'),
    comments: OBSERVATION_COMMENTS
  },
  {
    name: 'wld_incidental_all',
    sql: buildViewSQL('wld_incidental_all', OBSERVATION_QUERY, OBSERVATION_COLUMNS, false, 'incidental'),
    comments: OBSERVATION_COMMENTS
  }
] as const;

// Preserve the original migration rollback order (reversed by down).
export const MATERIALISED_VIEW_NAMES: MaterialisedViewName[] = [
  'wld_telemetry_all',
  'wld_telemetry_public',
  'wld_observations_all',
  'wld_observations_public',
  'wld_incidental_all',
  'wld_incidental_public'
];
