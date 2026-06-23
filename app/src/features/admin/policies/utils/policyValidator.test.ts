import { validatePolicyDocument } from './policyValidator';

const context = {
  submissions: [{ submission_id: 1, name: 'Submission 1' } as any],
  featureTypes: [{ feature_type: { name: 'telemetry' }, properties: [] } as any],
  submissionFeaturesCache: new Map([[1, [{ submission_feature_id: 10, feature_type_name: 'telemetry' } as any]]])
};

describe('policyValidator', () => {
  it('returns no markers for a valid policy document', () => {
    const markers = validatePolicyDocument(
      JSON.stringify({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Allow', Resource: 'urn:1:telemetry:10' }]
      }),
      context
    );

    expect(markers).toEqual([]);
  });

  it('returns marker for invalid JSON', () => {
    const markers = validatePolicyDocument('{ invalid json', context);

    expect(markers.some((marker) => marker.message.includes('Invalid JSON'))).toBe(true);
  });

  it('returns marker for unknown submission id', () => {
    const markers = validatePolicyDocument(
      JSON.stringify({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Allow', Resource: 'urn:999:telemetry:*' }]
      }),
      context
    );

    expect(markers.some((marker) => marker.message.includes('Unknown submission id "999"'))).toBe(true);
  });

  it('returns marker for unknown feature type', () => {
    const markers = validatePolicyDocument(
      JSON.stringify({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Allow', Resource: 'urn:1:unknown:*' }]
      }),
      context
    );

    expect(markers.some((marker) => marker.message.includes('Unknown feature type "unknown"'))).toBe(true);
  });
});
