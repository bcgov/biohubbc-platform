import { describe, expect, it } from 'vitest';
import {
  transformPolicyJsonToApi,
  transformApiToPolicyJson,
  transformPolicyToJson,
  validatePolicyJson,
  defaultPolicyDocument
} from './policyTransform';

describe('policyTransform', () => {
  describe('defaultPolicyDocument', () => {
    it('has correct default structure', () => {
      expect(defaultPolicyDocument).toEqual({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*'
          }
        ]
      });
    });
  });

  describe('transformPolicyJsonToApi', () => {
    it('transforms basic policy with single statement', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:1:telemetry:*'
          }
        ]
      });

      const result = transformPolicyJsonToApi(policyJson);

      expect(result).toEqual([
        {
          effect: 'allow',
          submission_feature_urn: 'urn:1:telemetry:*',
          conditions: undefined
        }
      ]);
    });

    it('transforms policy with Deny effect', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Deny',
            Resource: 'urn:*:*:*'
          }
        ]
      });

      const result = transformPolicyJsonToApi(policyJson);

      expect(result[0].effect).toBe('deny');
    });

    it('transforms policy with conditions', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:1:telemetry:*',
            Condition: [
              {
                Operator: 'StringEquals',
                Key: 'sex',
                Value: 'Male'
              }
            ]
          }
        ]
      });

      const result = transformPolicyJsonToApi(policyJson);

      expect(result[0].conditions).toEqual([
        {
          operator: 'StringEquals',
          key: 'sex',
          value: '"Male"'
        }
      ]);
    });

    it('stringifies complex condition values', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: [
              {
                Operator: 'StringEquals',
                Key: 'name',
                Value: ['value1', 'value2']
              }
            ]
          }
        ]
      });

      const result = transformPolicyJsonToApi(policyJson);

      expect(result[0].conditions?.[0].value).toBe('["value1","value2"]');
    });

    it('transforms multiple statements', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          { Effect: 'Allow', Resource: 'urn:1:*:*' },
          { Effect: 'Deny', Resource: 'urn:2:*:*' }
        ]
      });

      const result = transformPolicyJsonToApi(policyJson);

      expect(result).toHaveLength(2);
      expect(result[0].effect).toBe('allow');
      expect(result[1].effect).toBe('deny');
    });
  });

  describe('transformApiToPolicyJson', () => {
    it('transforms basic API response to policy JSON', () => {
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:1:telemetry:*',
          conditions: []
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:1:telemetry:*'
          }
        ]
      });
    });

    it('transforms deny effect correctly', () => {
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'deny' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: []
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed.Statement[0].Effect).toBe('Deny');
    });

    it('transforms statements with string condition values', () => {
      // PostgreSQL jsonb returns parsed values, so strings come back as JS strings
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:1:telemetry:*',
          conditions: [
            {
              policy_statement_condition_id: 'uuid-cond-1',
              policy_statement_id: 'uuid-1',
              operator: 'StringEquals',
              key: 'sex',
              value: 'Male' // Already parsed by PostgreSQL jsonb
            }
          ]
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed.Statement[0].Condition).toEqual([
        {
          Operator: 'StringEquals',
          Key: 'sex',
          Value: 'Male'
        }
      ]);
    });

    it('transforms statements with array condition values', () => {
      // PostgreSQL jsonb returns parsed values, so arrays come back as JS arrays
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: [
            {
              policy_statement_condition_id: 'uuid-cond-1',
              policy_statement_id: 'uuid-1',
              operator: 'StringEquals',
              key: 'name',
              value: ['value1', 'value2'] // Already parsed by PostgreSQL jsonb
            }
          ]
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed.Statement[0].Condition[0].Value).toEqual(['value1', 'value2']);
    });

    it('transforms statements with numeric condition values', () => {
      // PostgreSQL jsonb returns parsed values, so numbers stay as JS numbers
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: [
            {
              policy_statement_condition_id: 'uuid-cond-1',
              policy_statement_id: 'uuid-1',
              operator: 'NumericEquals',
              key: 'count',
              value: 42 // Already parsed by PostgreSQL jsonb
            }
          ]
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed.Statement[0].Condition[0].Value).toBe(42);
    });

    it('preserves numeric strings as strings (not converted to numbers)', () => {
      // Critical test: when user enters "333" as a STRING value, it must stay a string
      // PostgreSQL jsonb stores '"333"' and returns JS string "333"
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: [
            {
              policy_statement_condition_id: 'uuid-cond-1',
              policy_statement_id: 'uuid-1',
              operator: 'StringEquals',
              key: 'comment',
              value: '333' // String "333", NOT number 333
            }
          ]
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      // Must be string "333", not number 333
      expect(parsed.Statement[0].Condition[0].Value).toBe('333');
      expect(typeof parsed.Statement[0].Condition[0].Value).toBe('string');
    });

    it('omits Condition when empty', () => {
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: []
        }
      ];

      const result = transformApiToPolicyJson(statements);
      const parsed = JSON.parse(result);

      expect(parsed.Statement[0].Condition).toBeUndefined();
    });

    it('returns properly formatted JSON with indentation', () => {
      const statements = [
        {
          policy_statement_id: 'uuid-1',
          policy_id: 'policy-1',
          effect: 'allow' as const,
          submission_feature_urn: 'urn:*:*:*',
          conditions: []
        }
      ];

      const result = transformApiToPolicyJson(statements);

      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('transformPolicyToJson', () => {
    it('transforms full policy object to JSON', () => {
      const policy = {
        policy_id: 'uuid-policy',
        name: 'Test Policy',
        description: 'A test policy',
        statements: [
          {
            policy_statement_id: 'uuid-1',
            policy_id: 'uuid-policy',
            effect: 'allow' as const,
            submission_feature_urn: 'urn:*:*:*',
            conditions: []
          }
        ]
      };

      const result = transformPolicyToJson(policy);
      const parsed = JSON.parse(result);

      expect(parsed.Version).toBe('2025-12-01');
      expect(parsed.Statement).toHaveLength(1);
    });
  });

  describe('validatePolicyJson', () => {
    it('returns null for valid policy', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBeNull();
    });

    it('returns error for invalid JSON', () => {
      const result = validatePolicyJson('not valid json');

      expect(result).toContain('Invalid JSON');
    });

    it('returns error for missing Version', () => {
      const policyJson = JSON.stringify({
        Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*' }]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Policy must have a Version field');
    });

    it('returns error for missing Statement', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01'
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Policy must have a Statement array');
    });

    it('returns error for non-array Statement', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: 'not an array'
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Policy must have a Statement array');
    });

    it('returns error for empty Statement array', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: []
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Policy must have at least one statement');
    });

    it('returns error for invalid Effect', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Invalid',
            Resource: 'urn:*:*:*'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1: Effect must be "Allow" or "Deny"');
    });

    it('returns error for missing Effect', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Resource: 'urn:*:*:*'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1: Effect must be "Allow" or "Deny"');
    });

    it('returns error for missing Resource', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1: Resource is required');
    });

    it('returns error for invalid URN format', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'invalid-urn'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe(
        'Statement 1: Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>'
      );
    });

    it('accepts valid URN with wildcards', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBeNull();
    });

    it('accepts valid URN with specific values', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:123:telemetry:456'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBeNull();
    });

    it('returns error for non-array Condition', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: 'not an array'
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1: Condition must be an array');
    });

    it('returns error for condition missing Operator', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: [
              {
                Key: 'name',
                Value: 'test'
              }
            ]
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1, Condition 1: Operator is required');
    });

    it('returns error for condition missing Key', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: [
              {
                Operator: 'StringEquals',
                Value: 'test'
              }
            ]
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1, Condition 1: Key is required');
    });

    it('returns error for condition missing Value', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: [
              {
                Operator: 'StringEquals',
                Key: 'name'
              }
            ]
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 1, Condition 1: Value is required');
    });

    it('accepts valid condition', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:*:*',
            Condition: [
              {
                Operator: 'StringEquals',
                Key: 'name',
                Value: 'test'
              }
            ]
          }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBeNull();
    });

    it('validates multiple statements correctly', () => {
      const policyJson = JSON.stringify({
        Version: '2025-12-01',
        Statement: [
          { Effect: 'Allow', Resource: 'urn:1:*:*' },
          { Effect: 'Invalid', Resource: 'urn:2:*:*' }
        ]
      });

      const result = validatePolicyJson(policyJson);

      expect(result).toBe('Statement 2: Effect must be "Allow" or "Deny"');
    });
  });
});
