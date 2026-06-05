import { describe, expect, it } from 'vitest';
import { getSearchFeatureTypeRouteConfig } from './routes';

describe('getSearchFeatureTypeRouteConfig', () => {
  const featureTypes = [
    {
      feature_type: {
        name: 'dataset',
        display_name: 'Dataset'
      }
    }
  ];

  it('normalizes route casing before matching feature type metadata', () => {
    expect(getSearchFeatureTypeRouteConfig(' DATASET ', featureTypes)).toEqual({
      featureTypeName: 'dataset',
      title: 'Datasets'
    });
  });
});
