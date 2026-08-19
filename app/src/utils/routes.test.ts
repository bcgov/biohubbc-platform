import { describe, expect, it } from 'vitest';
import { buildSubmissionTaxonPath, getSearchFeatureTypeRouteConfig } from './routes';

describe('getSearchFeatureTypeRouteConfig', () => {
  const featureTypes = [
    {
      feature_type: {
        name: 'survey',
        display_name: 'Survey'
      }
    }
  ];

  it('normalizes route casing before matching feature type metadata', () => {
    expect(getSearchFeatureTypeRouteConfig(' SURVEY ', featureTypes)).toEqual({
      featureTypeName: 'survey',
      title: 'Surveys'
    });
  });
});

describe('buildSubmissionTaxonPath', () => {
  it('builds the taxon path under the given submission route base', () => {
    expect(buildSubmissionTaxonPath('/submission', 18, 180543)).toBe('/submission/18/taxon/180543');
    expect(buildSubmissionTaxonPath('/portal/submission', '18', 180543, '?view=table')).toBe(
      '/portal/submission/18/taxon/180543?view=table'
    );
  });
});
