import { describe, expect, it } from 'vitest';
import { getSearchFeatureTypeRouteConfig } from './routes';

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
