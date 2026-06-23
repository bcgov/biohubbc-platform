import {
  defaultPolicyDocument,
  transformApiToPolicyJson,
  transformPolicyJsonToApi,
  transformPolicyToJson,
  validatePolicyJson
} from './policyTransform';

describe('policyTransform', () => {
  describe('defaultPolicyDocument', () => {
    it('creates a default allow-all statement', () => {
      expect(defaultPolicyDocument).toEqual({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*' }]
      });
    });
  });

  describe('transformPolicyJsonToApi', () => {
    it('transforms statements to API payloads', () => {
      const result = transformPolicyJsonToApi(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [
            { Effect: 'Allow', Resource: 'urn:*:telemetry:*' },
            { Effect: 'Deny', Resource: 'urn:1:observation:2' }
          ]
        })
      );

      expect(result).toEqual([
        { effect: 'allow', submission_feature_urn: 'urn:*:telemetry:*' },
        { effect: 'deny', submission_feature_urn: 'urn:1:observation:2' }
      ]);
    });
  });

  describe('transformApiToPolicyJson', () => {
    it('transforms API statements to JSON policy document', () => {
      const result = transformApiToPolicyJson([
        {
          policy_statement_id: 'uuid-stmt-1',
          policy_id: 'uuid-policy-1',
          effect: 'allow',
          submission_feature_urn: 'urn:*:telemetry:*'
        }
      ]);

      expect(JSON.parse(result)).toEqual({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Allow', Resource: 'urn:*:telemetry:*' }]
      });
    });
  });

  describe('transformPolicyToJson', () => {
    it('transforms a policy to JSON policy document', () => {
      const result = transformPolicyToJson({
        policy_id: 'uuid-policy-1',
        name: 'Policy',
        description: null,
        status: 'approved' as any,
        statements: [
          {
            policy_statement_id: 'uuid-stmt-1',
            policy_id: 'uuid-policy-1',
            effect: 'deny',
            submission_feature_urn: 'urn:*:*:*'
          }
        ]
      });

      expect(JSON.parse(result)).toEqual({
        Version: '2025-12-01',
        Statement: [{ Effect: 'Deny', Resource: 'urn:*:*:*' }]
      });
    });
  });

  describe('validatePolicyJson', () => {
    it('validates a policy document with statements', () => {
      const result = validatePolicyJson(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*' }]
        })
      );

      expect(result.valid).toBe(true);
    });

    it('returns error for invalid URN', () => {
      const result = validatePolicyJson(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [{ Effect: 'Allow', Resource: 'invalid' }]
        })
      );

      expect(result).toEqual({
        valid: false,
        error: 'Statement 1: Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>'
      });
    });
  });
});
