import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import {
  defaultPolicyDocument,
  transformPolicyFormToApiStatements,
  transformApiToPolicyJson,
  transformPolicyJsonToApi,
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

    it('preserves existing policy expression links for unchanged statements', () => {
      const result = transformPolicyJsonToApi(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [
            { Effect: 'Allow', Resource: 'urn:*:telemetry:*' },
            { Effect: 'Deny', Resource: 'urn:1:observation:2' }
          ]
        }),
        [
          {
            policy_statement_id: 'uuid-stmt-1',
            policy_id: 'uuid-policy-1',
            effect: 'allow',
            submission_feature_urn: 'urn:*:telemetry:*',
            policy_expression_id: 'uuid-policy-expression-1'
          },
          {
            policy_statement_id: 'uuid-stmt-2',
            policy_id: 'uuid-policy-1',
            effect: 'deny',
            submission_feature_urn: 'urn:1:observation:2',
            policy_expression_id: null
          }
        ]
      );

      expect(result).toEqual([
        {
          effect: 'allow',
          submission_feature_urn: 'urn:*:telemetry:*',
          policy_expression_id: 'uuid-policy-expression-1'
        },
        { effect: 'deny', submission_feature_urn: 'urn:1:observation:2' }
      ]);
    });

    it('does not carry expression links onto changed statements', () => {
      const result = transformPolicyJsonToApi(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [{ Effect: 'Allow', Resource: 'urn:*:observation:*' }]
        }),
        [
          {
            policy_statement_id: 'uuid-stmt-1',
            policy_id: 'uuid-policy-1',
            effect: 'allow',
            submission_feature_urn: 'urn:*:telemetry:*',
            policy_expression_id: 'uuid-policy-expression-1'
          }
        ]
      );

      expect(result).toEqual([{ effect: 'allow', submission_feature_urn: 'urn:*:observation:*' }]);
    });
  });

  describe('transformPolicyFormToApiStatements', () => {
    it('transforms single-statement expression form values', () => {
      const expression = {
        type: 'expression' as const,
        operator: 'AND' as const,
        clauses: [
          {
            type: 'predicate' as const,
            feature_property_id: 1,
            feature_type_property_id: null,
            operator: 'Equals' as const,
            value: 'north'
          }
        ]
      };

      expect(
        transformPolicyFormToApiStatements({
          name: 'Expression Policy',
          description: '',
          status: PolicyStatus.REQUESTED,
          statement_effect: 'allow',
          submission_feature_urn: 'urn:*:*:*',
          expression
        })
      ).toEqual([
        {
          effect: 'allow',
          submission_feature_urn: 'urn:*:*:*',
          expression
        }
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
          submission_feature_urn: 'urn:*:telemetry:*',
          policy_expression_id: 'uuid-policy-expression-1'
        }
      ]);

      expect(JSON.parse(result)).toEqual({
        Version: '2025-12-01',
        Statement: [
          {
            Effect: 'Allow',
            Resource: 'urn:*:telemetry:*'
          }
        ]
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

    it('returns error for expression fields because the JSON editor does not manage expressions', () => {
      const result = validatePolicyJson(
        JSON.stringify({
          Version: '2025-12-01',
          Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*', PolicyExpressionId: 'uuid-policy-expression-1' }]
        })
      );

      expect(result).toEqual({
        valid: false,
        error: 'Statement 1: Unsupported field "PolicyExpressionId"'
      });
    });
  });
});
