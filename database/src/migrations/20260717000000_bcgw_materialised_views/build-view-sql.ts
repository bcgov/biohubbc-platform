import { BCGW_SCHEMA } from './config';
import { buildTaxonFilter, effectivelySecuredExpression } from './filters';
import { MaterialisedViewColumn, MaterialisedViewName, SiteFilter } from './types';

const buildColumns = (columns: MaterialisedViewColumn[], isPublic: boolean): string => {
  const securedColumn = isPublic
    ? "'N'"
    : `CASE WHEN ${effectivelySecuredExpression('sf.submission_feature_id')} THEN 'Y' ELSE 'N' END`;

  return columns
    .map((column) => `${column.expression.replace('{securedColumn}', securedColumn)} AS ${column.alias}`)
    .join(',\n    ');
};

export const buildViewSQL = (
  name: MaterialisedViewName,
  query: string,
  columns: MaterialisedViewColumn[],
  isPublic: boolean,
  siteFilter?: SiteFilter
): string => {
  const selectedColumns = columns.map((column) => column.alias).join(',\n  ');
  const securityFilter = isPublic ? `AND NOT ${effectivelySecuredExpression('filter_feature_id')}` : '';
  const observationSiteFilter =
    siteFilter === 'linked'
      ? 'AND sf.submission_feature_id IN (SELECT submission_feature_id FROM site_linked_observations)'
      : siteFilter === 'incidental'
      ? 'AND sf.submission_feature_id NOT IN (SELECT submission_feature_id FROM site_linked_observations)'
      : '';

  const sql = query
    .replace('{columns}', buildColumns(columns, isPublic))
    .replace('{selectedColumns}', selectedColumns)
    .replace('{siteFilter}', observationSiteFilter)
    .replace('{taxonExclusionFilter}', buildTaxonFilter('filter_taxon_id'))
    .replace('{securityFilter}', securityFilter);

  return `CREATE MATERIALIZED VIEW ${BCGW_SCHEMA}.${name}_new AS
${sql};`;
};
