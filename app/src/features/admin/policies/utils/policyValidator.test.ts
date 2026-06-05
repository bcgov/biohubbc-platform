import { FeatureTypeWithProperties } from 'interfaces/useCodesApi.interface';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import {
  ISubmissionFeatureForReview,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';
import { describe, expect, it } from 'vitest';
import {
  findColumnRange,
  findLineNumber,
  IValidationContext,
  validatePolicyDocument,
  ValidationMarkerSeverity
} from './policyValidator';

/**
 * Create a mock submission record for testing.
 *
 * @param {number} id - Submission ID
 * @returns {SubmissionRecordWithSecurityAndRootFeature} Mock submission record
 */
const createMockSubmission = (id: number): SubmissionRecordWithSecurityAndRootFeature => ({
  submission_id: id,
  uuid: `uuid-${id}`,
  security_review_timestamp: null,
  publish_timestamp: '2024-01-01T00:00:00Z',
  submitted_timestamp: '2024-01-01T00:00:00Z',
  contributor_id: 1,
  name: `Submission ${id}`,
  description: 'Test submission',
  comment: '',
  create_date: '2024-01-01T00:00:00Z',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  security: SECURITY_APPLIED_STATUS.SECURED,
  root_feature_type_id: 1,
  root_feature_type_name: 'animal',
  regions: []
});

/**
 * Create a mock feature type with properties for testing.
 *
 * @returns {FeatureTypeWithProperties} Mock feature type
 */
const createMockFeatureType = (): FeatureTypeWithProperties => ({
  feature_type: {
    feature_type_id: 1,
    name: 'animal',
    display_name: 'Animal',
    description: null
  },
  properties: [
    {
      feature_type_property_id: 1,
      name: 'species',
      display_name: 'Species',
      description: 'Species',
      type_name: 'string',
      required_value: false,
      calculated_value: false
    },
    {
      feature_type_property_id: 2,
      name: 'count',
      display_name: 'Count',
      description: 'Count',
      type_name: 'number',
      required_value: false,
      calculated_value: false
    },
    {
      feature_type_property_id: 3,
      name: 'observed_date',
      display_name: 'Observed Date',
      description: 'Observed date',
      type_name: 'datetime',
      required_value: false,
      calculated_value: false
    },
    {
      feature_type_property_id: 4,
      name: 'is_verified',
      display_name: 'Is Verified',
      description: 'Is verified',
      type_name: 'boolean',
      required_value: false,
      calculated_value: false
    },
    {
      feature_type_property_id: 5,
      name: 'location',
      display_name: 'Location',
      description: 'Location',
      type_name: 'spatial',
      required_value: false,
      calculated_value: false
    }
  ]
});

/**
 * Create a mock submission features response for testing.
 *
 * @param {number} submissionId - Submission ID
 * @returns {ISubmissionFeatureForReview[]} Mock features
 */
const createMockFeatureGroups = (submissionId: number): ISubmissionFeatureForReview[] => [
  {
    submission_feature_id: 100,
    uuid: 'feature-uuid-100',
    submission_id: submissionId,
    feature_type_id: 1,
    feature_type_name: 'animal',
    secured: false,
    submission_feature_security_ids: []
  },
  {
    submission_feature_id: 101,
    uuid: 'feature-uuid-101',
    submission_id: submissionId,
    feature_type_id: 1,
    feature_type_name: 'animal',
    secured: false,
    submission_feature_security_ids: []
  }
];

/**
 * Create a mock validation context for testing.
 *
 * @returns {IValidationContext} Mock validation context
 */
const createMockContext = (): IValidationContext => ({
  submissions: [createMockSubmission(1), createMockSubmission(2)],
  featureTypes: [createMockFeatureType()],
  submissionFeaturesCache: new Map([[1, createMockFeatureGroups(1)]])
});

describe('policyValidator', () => {
  describe('findLineNumber', () => {
    it('finds string on first line', () => {
      const text = '{"Version": "1.0"}';
      expect(findLineNumber(text, '"Version"')).toBe(1);
    });

    it('finds string on second line', () => {
      const text = '{\n  "Version": "1.0"\n}';
      expect(findLineNumber(text, '"Version"')).toBe(2);
    });

    it('returns 1 when string not found', () => {
      const text = '{"Version": "1.0"}';
      expect(findLineNumber(text, '"NotFound"')).toBe(1);
    });

    it('respects startLine parameter', () => {
      const text = '{\n  "Effect": "Allow",\n  "Effect": "Deny"\n}';
      expect(findLineNumber(text, '"Effect"', 1)).toBe(2);
      expect(findLineNumber(text, '"Effect"', 3)).toBe(3);
    });
  });

  describe('findColumnRange', () => {
    it('finds column range for value in line', () => {
      const line = '  "Resource": "urn:1:animal:*"';
      const { start, end } = findColumnRange(line, 'urn:1:animal:*');
      expect(start).toBe(16);
      expect(end).toBe(30);
    });

    it('returns full line range when value not found', () => {
      const line = '  "Resource": "urn:1:animal:*"';
      const { start, end } = findColumnRange(line, 'notfound');
      expect(start).toBe(1);
      expect(end).toBe(31);
    });
  });

  describe('validatePolicyDocument', () => {
    const mockContext = createMockContext();

    describe('JSON Syntax Validation', () => {
      it('returns marker for empty string', () => {
        const markers = validatePolicyDocument('', mockContext);
        expect(markers).toHaveLength(1);
        expect(markers[0].message).toContain('cannot be empty');
      });

      it('returns marker for whitespace only', () => {
        const markers = validatePolicyDocument('   ', mockContext);
        expect(markers).toHaveLength(1);
        expect(markers[0].message).toContain('cannot be empty');
      });

      it('returns marker for invalid JSON', () => {
        const markers = validatePolicyDocument('{ "Version": }', mockContext);
        expect(markers).toHaveLength(1);
        expect(markers[0].message).toContain('Invalid JSON');
        expect(markers[0].severity).toBe(ValidationMarkerSeverity.Error);
      });

      it('returns marker for missing Version', () => {
        const policy = JSON.stringify({ Statement: [] }, null, 2);
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Missing required field: Version'))).toBe(true);
      });

      it('returns marker for missing Statement', () => {
        const policy = JSON.stringify({ Version: '2025-12-01' }, null, 2);
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Missing required field: Statement'))).toBe(true);
      });

      it('returns marker for Statement not being an array', () => {
        const policy = JSON.stringify({ Version: '2025-12-01', Statement: {} }, null, 2);
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Statement must be an array'))).toBe(true);
      });

      it('returns marker for missing Effect in statement', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Resource: 'urn:*:*:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Statement 1: Missing required field: Effect'))).toBe(true);
      });

      it('returns marker for invalid Effect value', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Maybe', Resource: 'urn:*:*:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Effect must be "Allow" or "Deny"'))).toBe(true);
      });

      it('returns marker for missing Resource in statement', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Statement 1: Missing required field: Resource'))).toBe(true);
      });
    });

    describe('URN Validation', () => {
      it('returns marker for invalid URN format', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'invalid' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid URN format'))).toBe(true);
      });

      it('returns marker for URN missing parts', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:1:animal' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid URN format'))).toBe(true);
      });

      it('returns marker for non-existent submission', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:999:animal:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Submission 999 does not exist'))).toBe(true);
      });

      it('returns marker for non-existent feature type', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:1:invalid_type:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Feature type "invalid_type" does not exist'))).toBe(true);
      });

      it('returns marker for non-existent feature ID', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:1:animal:999' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Feature 999 does not exist in submission 1'))).toBe(true);
      });

      it('returns no marker for valid wildcard submission', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:*:animal:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid wildcard feature type', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:1:*:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid specific URN', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:1:animal:100' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('skips feature ID validation when submission not in cache', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:2:animal:999' }]
          },
          null,
          2
        );
        // Submission 2 exists but is not in the features cache
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });
    });

    describe('Condition Validation', () => {
      it('returns marker for unknown operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'FakeOp', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Unknown operator "FakeOp"'))).toBe(true);
      });

      it('returns marker for property that does not exist', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'fake_prop', Value: 'test' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(
          markers.some((m) => m.message.includes('Property "fake_prop" does not exist on feature type "animal"'))
        ).toBe(true);
      });

      it('returns marker for string operator on number property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'count', Value: '5' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(
          markers.some((m) => m.message.includes('Operator "StringEquals" is not valid for property type "number"'))
        ).toBe(true);
      });

      it('returns marker for numeric operator on string property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'species', Value: 5 }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(
          markers.some((m) => m.message.includes('Operator "NumericEquals" is not valid for property type "string"'))
        ).toBe(true);
      });

      it('returns marker for date operator on string property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'species', Value: '2024-01-01' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(
          markers.some((m) => m.message.includes('Operator "DateAfter" is not valid for property type "string"'))
        ).toBe(true);
      });

      it('returns marker for bool operator on string property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Bool', Key: 'species', Value: true }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Operator "Bool" is not valid for property type "string"'))).toBe(
          true
        );
      });

      it('returns no marker for valid string condition', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid numeric condition', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'count', Value: 5 }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('skips property validation for wildcard feature type', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'StringEquals', Key: 'any_property', Value: 'test' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for empty Key value', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: '', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Key is required'))).toBe(true);
      });

      it('returns marker for empty Operator value', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: '', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Operator is required'))).toBe(true);
      });

      it('returns marker for missing Value', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Value is required'))).toBe(true);
      });

      it('returns marker for empty string Value', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Value is required'))).toBe(true);
      });

      it('returns marker for invalid date format on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-06-' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      it('returns marker for non-date string on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateBefore', Key: 'observed_date', Value: 'not-a-date' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      it('returns marker for impossible date on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-13-45' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      it('returns no marker for valid ISO date (date only) on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-06-15' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid ISO date (full datetime) on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2025-12-02T00:10:06.910Z' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for invalid date in array on datetime property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: ['2024-06-15', 'bad-date'] }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid date format "bad-date"'))).toBe(true);
      });

      it('validates date format from operator when feature type is wildcard', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'DateAfter', Key: 'some_date', Value: 'not-a-date' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        // Should validate date format based on operator even with wildcard feature type
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      it('validates number format from operator when feature type is wildcard', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'some_count', Value: 'not-a-number' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid number value'))).toBe(true);
      });

      it('validates boolean format from operator when feature type is wildcard', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'Bool', Key: 'some_flag', Value: 'yes' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid boolean value'))).toBe(true);
      });

      it('validates GeoJSON from operator when feature type is wildcard', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'Within', Key: 'some_location', Value: 'not-geojson' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      it('skips value validation for string operators with wildcard feature type', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:*:*',
                Condition: [{ Operator: 'StringEquals', Key: 'some_field', Value: 'any value is fine' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        // String operators can't infer type, so no value validation
        expect(markers).toHaveLength(0);
      });

      it('validates value format from operator even when Key does not exist on feature type', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'unknown_key', Value: 'not-a-date' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        // Should have both "property does not exist" error and date format error (inferred from operator)
        expect(markers.some((m) => m.message.includes('does not exist'))).toBe(true);
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      // Number validation tests
      it('returns marker for string value on number property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'count', Value: '42' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid number value'))).toBe(true);
      });

      it('returns no marker for valid number value on number property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'count', Value: 42 }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for string in number array', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'NumericEquals', Key: 'count', Value: [1, '2', 3] }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid number value'))).toBe(true);
      });

      // Boolean validation tests
      it('returns marker for string value on boolean property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Bool', Key: 'is_verified', Value: 'true' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid boolean value'))).toBe(true);
      });

      it('returns no marker for valid boolean value on boolean property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Bool', Key: 'is_verified', Value: true }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      // Spatial/GeoJSON validation tests
      it('returns marker for invalid GeoJSON on spatial property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Within', Key: 'location', Value: { invalid: 'object' } }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      it('returns marker for string value on spatial property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Within', Key: 'location', Value: 'not geojson' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      it('returns no marker for valid GeoJSON Point on spatial property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [
                  { Operator: 'Within', Key: 'location', Value: { type: 'Point', coordinates: [-123.0, 49.0] } }
                ]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid GeoJSON Polygon on spatial property', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [
                  {
                    Operator: 'Within',
                    Key: 'location',
                    Value: {
                      type: 'Polygon',
                      coordinates: [
                        [
                          [-123.0, 49.0],
                          [-122.0, 49.0],
                          [-122.0, 50.0],
                          [-123.0, 50.0],
                          [-123.0, 49.0]
                        ]
                      ]
                    }
                  }
                ]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for GeoJSON missing coordinates', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Within', Key: 'location', Value: { type: 'Point' } }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      // DateBefore valid test
      it('returns no marker for valid ISO date with DateBefore operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateBefore', Key: 'observed_date', Value: '2025-12-31T23:59:59.999Z' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid ISO datetime without milliseconds', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-06-15T12:30:00Z' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid ISO datetime with positive timezone offset', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-06-15T12:30:00+05:30' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no marker for valid ISO datetime with negative timezone offset', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateBefore', Key: 'observed_date', Value: '2024-06-15T08:00:00-08:00' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for invalid time format in datetime', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'DateAfter', Key: 'observed_date', Value: '2024-06-15T12:30' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid date format'))).toBe(true);
      });

      // Intersects operator tests
      it('returns no marker for valid GeoJSON with Intersects operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [
                  { Operator: 'Intersects', Key: 'location', Value: { type: 'Point', coordinates: [-123.0, 49.0] } }
                ]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for invalid GeoJSON with Intersects operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Intersects', Key: 'location', Value: 'not-geojson' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      // Contains operator tests
      it('returns no marker for valid GeoJSON with Contains operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [
                  {
                    Operator: 'Contains',
                    Key: 'location',
                    Value: {
                      type: 'Polygon',
                      coordinates: [
                        [
                          [-123.0, 49.0],
                          [-122.0, 49.0],
                          [-122.0, 50.0],
                          [-123.0, 50.0],
                          [-123.0, 49.0]
                        ]
                      ]
                    }
                  }
                ]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for invalid GeoJSON with Contains operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'Contains', Key: 'location', Value: { invalid: 'object' } }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid GeoJSON'))).toBe(true);
      });

      // String operator validation tests
      it('returns marker for number value with StringEquals operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species', Value: 333 }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid string value'))).toBe(true);
      });

      it('returns no marker for valid string value with StringEquals operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns marker for number value with StringNotEquals operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringNotEquals', Key: 'species', Value: 123 }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid string value'))).toBe(true);
      });

      it('returns marker for boolean value with StringLike operator', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringLike', Key: 'species', Value: true }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid string value'))).toBe(true);
      });

      it('returns marker for number in string array', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species', Value: ['bear', 123, 'wolf'] }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Invalid string value'))).toBe(true);
      });
    });

    describe('Full Document Validation', () => {
      it('returns no markers for valid minimal policy', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no markers for valid policy with condition', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Deny',
                Resource: 'urn:1:animal:*',
                Condition: [{ Operator: 'StringEquals', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns multiple markers for multiple errors', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:999:invalid_type:*',
                Condition: [{ Operator: 'FakeOp', Key: 'species', Value: 'bear' }]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        // Should have: submission doesn't exist, feature type doesn't exist, unknown operator
        expect(markers.length).toBeGreaterThanOrEqual(3);
      });

      it('references correct statement number for errors in second statement', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              { Effect: 'Allow', Resource: 'urn:*:*:*' },
              { Effect: 'Deny', Resource: 'urn:999:animal:*' }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Statement 2'))).toBe(true);
      });

      it('references correct condition number for errors in second condition', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [
              {
                Effect: 'Allow',
                Resource: 'urn:1:animal:*',
                Condition: [
                  { Operator: 'StringEquals', Key: 'species', Value: 'bear' },
                  { Operator: 'FakeOp', Key: 'species', Value: 'wolf' }
                ]
              }
            ]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers.some((m) => m.message.includes('Condition 2'))).toBe(true);
      });

      it('returns no markers for empty Statement array', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: []
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });

      it('returns no markers for wildcard-only URN', () => {
        const policy = JSON.stringify(
          {
            Version: '2025-12-01',
            Statement: [{ Effect: 'Allow', Resource: 'urn:*:*:*' }]
          },
          null,
          2
        );
        const markers = validatePolicyDocument(policy, mockContext);
        expect(markers).toHaveLength(0);
      });
    });

    describe('Line/Column Position Tests', () => {
      it('marker has correct line number for URN error', () => {
        const policy = `{
  "Version": "2025-12-01",
  "Statement": [
    {
      "Effect": "Allow",
      "Resource": "urn:999:animal:*"
    }
  ]
}`;
        const markers = validatePolicyDocument(policy, mockContext);
        const urnMarker = markers.find((m) => m.message.includes('Submission 999'));
        expect(urnMarker).toBeDefined();
        expect(urnMarker!.startLineNumber).toBe(6); // Line with Resource
      });

      it('marker columns span the URN string', () => {
        const policy = `{
  "Version": "2025-12-01",
  "Statement": [
    {
      "Effect": "Allow",
      "Resource": "urn:999:animal:*"
    }
  ]
}`;
        const markers = validatePolicyDocument(policy, mockContext);
        const urnMarker = markers.find((m) => m.message.includes('Submission 999'));
        expect(urnMarker).toBeDefined();
        // URN starts after "Resource": "
        expect(urnMarker!.startColumn).toBeGreaterThan(1);
        expect(urnMarker!.endColumn).toBeGreaterThan(urnMarker!.startColumn);
      });
    });
  });
});
