import { OBSERVATIONS_BASE_QUERY } from '../sql/observations.sql';
import { TELEMETRY_BASE_QUERY } from '../sql/telemetry.sql';
import { MaterializedViewDefinition } from '../types';
import { buildSecurityFilter } from './build-security';
import { SECURITY_CONFIG } from '../config/mv.security';

export function buildMaterializedViewSQL(definition: MaterializedViewDefinition): string {
  const { schema, name, columns, securityMode } = definition;

  // Adjust columns based on security mode
  const adjustedColumns = columns.map((col) => {
    if (col.alias === 'SECURED') {
      if (securityMode === 'public') {
        return { ...col, expression: "'N'" };
      } else if (securityMode === 'all') {
        return {
          ...col,
          expression:
            "CASE WHEN EXISTS (SELECT 1 FROM biohub.submission_feature_security sfs WHERE sfs.submission_feature_id = sf.submission_feature_id) THEN 'Y' ELSE 'N' END"
        };
      } else if (securityMode === 'secured') {
        // TODO: Implement secured logic
        return { ...col, expression: "'Y'" };
      }
    }
    return col;
  });

  // Generate column list
  const columnSQL = adjustedColumns.map((col) => `${col.expression} AS ${col.alias}`).join(',\n    ');

  // Determine base query
  let baseQuery: string;
  if (name.includes('telemetry')) {
    baseQuery = TELEMETRY_BASE_QUERY;
  } else if (name.includes('observations') || name.includes('incidental')) {
    baseQuery = OBSERVATIONS_BASE_QUERY;
  } else {
    throw new Error(`Unknown materialized view type for ${name}`);
  }

  // Apply security filter
  const securityFilter = buildSecurityFilter(securityMode, SECURITY_CONFIG);

  // Apply site filter for observations vs incidental
  let siteFilter = '';
  if (name.includes('observations')) {
    siteFilter = 'AND sf.submission_feature_id IN (SELECT submission_feature_id FROM site_linked_observations)';
  } else if (name.includes('incidental')) {
    siteFilter = 'AND sf.submission_feature_id NOT IN (SELECT submission_feature_id FROM site_linked_observations)';
  }

  // Replace placeholders
  const sql = baseQuery
    .replace('{columns}', columnSQL)
    .replace('{securityFilter}', securityFilter)
    .replace('{siteFilter}', siteFilter);

  return `CREATE MATERIALIZED VIEW ${schema}.${name} AS\n${sql};`;
}
