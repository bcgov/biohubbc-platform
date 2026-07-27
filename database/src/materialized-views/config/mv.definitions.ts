import { MaterializedViewDefinition } from '../types';
import { OBSERVATIONS_COLUMNS, TELEMETRY_COLUMNS } from './mv.columns';
import { OBSERVATIONS_COMMENTS, TELEMETRY_COMMENTS } from './mv.comments';

export const MATERIALIZED_VIEW_DEFINITIONS: MaterializedViewDefinition[] = [
  {
    schema: 'bcgw',
    name: 'telemetry_all',
    baseQuery: '', // Will be set by SQL builders
    columns: TELEMETRY_COLUMNS,
    securityMode: 'all',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: TELEMETRY_COMMENTS,
    enabled: true
  },
  {
    schema: 'bcgw',
    name: 'telemetry_public',
    baseQuery: '', // Will be set by SQL builders
    columns: TELEMETRY_COLUMNS,
    securityMode: 'public',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: TELEMETRY_COMMENTS,
    enabled: true
  },
  {
    schema: 'bcgw',
    name: 'observations_all',
    baseQuery: '', // Will be set by SQL builders
    columns: OBSERVATIONS_COLUMNS,
    securityMode: 'all',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: OBSERVATIONS_COMMENTS,
    enabled: true
  },
  {
    schema: 'bcgw',
    name: 'observations_public',
    baseQuery: '', // Will be set by SQL builders
    columns: OBSERVATIONS_COLUMNS,
    securityMode: 'public',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: OBSERVATIONS_COMMENTS,
    enabled: true
  },
  {
    schema: 'bcgw',
    name: 'incidental_all',
    baseQuery: '', // Will be set by SQL builders
    columns: OBSERVATIONS_COLUMNS, // Same columns as observations
    securityMode: 'all',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: OBSERVATIONS_COMMENTS,
    enabled: true
  },
  {
    schema: 'bcgw',
    name: 'incidental_public',
    baseQuery: '', // Will be set by SQL builders
    columns: OBSERVATIONS_COLUMNS, // Same columns as observations
    securityMode: 'public',
    featureTableAlias: 'sf',
    taxonRuleNames: ['excludeFish'],
    comments: OBSERVATIONS_COMMENTS,
    enabled: true
  }
];
