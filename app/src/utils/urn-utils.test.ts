import { describe, expect, it } from 'vitest';
import { parseFeatureUrn } from './urn-utils';

describe('parseFeatureUrn', () => {
  it('parses a feature urn into its components', () => {
    expect(parseFeatureUrn('urn:18:sample_site:3339')).toEqual({
      submissionId: 18,
      featureTypeName: 'sample_site',
      submissionFeatureId: 3339
    });
  });

  it('returns null for wildcard urns', () => {
    expect(parseFeatureUrn('urn:*:telemetry:*')).toBeNull();
    expect(parseFeatureUrn('urn:18:sample_site:*')).toBeNull();
  });

  it('returns null for malformed urns', () => {
    expect(parseFeatureUrn('urn:18:sample_site')).toBeNull();
    expect(parseFeatureUrn('urn:18:sample_site:3339:extra')).toBeNull();
    expect(parseFeatureUrn('feature:18:sample_site:3339')).toBeNull();
    expect(parseFeatureUrn('urn:18::3339')).toBeNull();
    expect(parseFeatureUrn('urn:-1:sample_site:3339')).toBeNull();
    expect(parseFeatureUrn('urn:18:sample_site:0')).toBeNull();
    expect(parseFeatureUrn('urn:1.5:sample_site:3339')).toBeNull();
  });
});
