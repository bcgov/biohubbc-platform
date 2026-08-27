import { describe, expect, it } from 'vitest';
import {
  buildSubmissionCodePath,
  buildSubmissionTaxonPath,
  getSearchFeatureTypeRouteConfig,
  parseRouteId
} from './routes';

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
    expect(buildSubmissionTaxonPath('/portal/submission', 18, 180543, '?view=table')).toBe(
      '/portal/submission/18/taxon/180543?view=table'
    );
  });
});

describe('parseRouteId', () => {
  it('parses a positive integer route parameter', () => {
    expect(parseRouteId('18')).toBe(18);
    expect(parseRouteId('1')).toBe(1);
  });

  it('returns null for parameters that do not identify a record', () => {
    expect(parseRouteId(undefined)).toBeNull();
    expect(parseRouteId('')).toBeNull();
    expect(parseRouteId('abc')).toBeNull();
    expect(parseRouteId('0')).toBeNull();
    expect(parseRouteId('-1')).toBeNull();
    expect(parseRouteId('1.5')).toBeNull();
    expect(parseRouteId('12abc')).toBeNull();
  });
});

describe('buildSubmissionCodePath', () => {
  it('builds the code path under the given submission route base', () => {
    expect(buildSubmissionCodePath('/submission', 18, 'sign', 'track')).toBe('/submission/18/code/sign/track');
    expect(buildSubmissionCodePath('/portal/submission', 18, 'sign', 'track', '?view=table')).toBe(
      '/portal/submission/18/code/sign/track?view=table'
    );
  });

  it('URL-encodes contributor-supplied keys', () => {
    expect(buildSubmissionCodePath('/submission', 18, 'site select/strategy', 'random walk')).toBe(
      '/submission/18/code/site%20select%2Fstrategy/random%20walk'
    );
  });
});
