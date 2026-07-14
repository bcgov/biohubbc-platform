import { parseFeatureUrn } from './urn-utils';

describe('parseFeatureUrn', () => {
  it('parses a valid feature urn', () => {
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
    expect(parseFeatureUrn('urn:18:sample_site')).toBeNull(); // too few parts
    expect(parseFeatureUrn('urn:18:sample_site:3339:extra')).toBeNull(); // too many parts
    expect(parseFeatureUrn('feature:18:sample_site:3339')).toBeNull(); // wrong prefix
    expect(parseFeatureUrn('urn:18::3339')).toBeNull(); // empty feature type
    expect(parseFeatureUrn('urn:-1:sample_site:3339')).toBeNull(); // non-positive submission id
    expect(parseFeatureUrn('urn:18:sample_site:0')).toBeNull(); // non-positive feature id
  });
});
