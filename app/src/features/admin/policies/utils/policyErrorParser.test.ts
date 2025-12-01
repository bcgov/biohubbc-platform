import { describe, expect, it } from 'vitest';
import {
  parsePolicyConditionError,
  parseUrnValidationError,
  parseSchemaValidationError,
  parsePolicyError
} from './policyErrorParser';

describe('policyErrorParser', () => {
  describe('parsePolicyConditionError', () => {
    it('parses invalid property key error', () => {
      const error =
        'Policy condition validation failed for key="invalid_key", operator="StringEquals": Invalid property key "invalid_key": not found in feature_type_property';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Property Key',
        message: 'The property "invalid_key" does not exist.',
        suggestion: 'Check the Key field and select a valid property from the autocomplete suggestions.'
      });
    });

    it('parses operator not valid for property type error', () => {
      const error =
        'Policy condition validation failed for key="sex", operator="DateAfter": Operator "DateAfter" not valid for property type "string". Valid operators: StringEquals, StringNotEquals, StringLike, Exists';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Incompatible Operator',
        message: 'The operator "DateAfter" cannot be used with the property "sex" (type: string).',
        suggestion: 'Valid operators for string properties: StringEquals, StringNotEquals, StringLike, Exists'
      });
    });

    it('parses Bool operator requires boolean value error', () => {
      const error =
        'Policy condition validation failed for key="active", operator="Bool": Bool operator requires a boolean value, got: string';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Value Type',
        message: 'The Bool operator requires a boolean value (true or false).',
        suggestion: 'Change the Value to true or false (without quotes).'
      });
    });

    it('parses Exists operator requires boolean value error', () => {
      const error =
        'Policy condition validation failed for key="name", operator="Exists": Exists operator requires a boolean value, got: string';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Value Type',
        message: 'The Exists operator requires a boolean value (true or false).',
        suggestion: 'Change the Value to true or false (without quotes).'
      });
    });

    it('parses NumericEquals requires number error', () => {
      const error =
        'Policy condition validation failed for key="count", operator="NumericEquals": NumericEquals operator requires a number or array of numbers, got: string';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Value Type',
        message: 'The NumericEquals operator requires a number or array of numbers.',
        suggestion: 'Change the Value to a number (e.g., 42) or an array of numbers (e.g., [1, 2, 3]).'
      });
    });

    it('parses StringEquals requires string error', () => {
      const error =
        'Policy condition validation failed for key="name", operator="StringEquals": StringEquals operator requires a string or array of strings, got: number';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Value Type',
        message: 'The StringEquals operator requires a string or array of strings.',
        suggestion: 'Change the Value to a string (e.g., "value") or an array (e.g., ["a", "b"]).'
      });
    });

    it('parses spatial operator requires GeoJSON error', () => {
      const error =
        'Policy condition validation failed for key="geometry", operator="Contains": Spatial operator Contains requires a GeoJSON object, got: string';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid GeoJSON',
        message: 'The Contains operator requires a valid GeoJSON geometry object.',
        suggestion:
          'The Value must be a GeoJSON object with a "type" field (e.g., {"type": "Polygon", "coordinates": [...]}).'
      });
    });

    it('parses spatial operator missing type field error', () => {
      const error =
        'Policy condition validation failed for key="geometry", operator="Within": Spatial operator Within requires valid GeoJSON with "type" field';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid GeoJSON',
        message: 'The spatial operator requires a GeoJSON object with a "type" field.',
        suggestion: 'Ensure the Value is a valid GeoJSON object like {"type": "Polygon", "coordinates": [[...]]}'
      });
    });

    it('parses DateAfter requires date string error', () => {
      const error =
        'Policy condition validation failed for key="observation_date", operator="DateAfter": DateAfter operator requires a date string or array of date strings, got: number';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Value Type',
        message: 'The DateAfter operator requires a date string or array of date strings.',
        suggestion: 'Change the Value to a date string (e.g., "2024-01-01") or an array of dates.'
      });
    });

    it('parses array element type mismatch error', () => {
      const error =
        'Policy condition validation failed for key="names", operator="StringEquals": StringEquals operator array must contain only strings, found: number';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Invalid Array Element',
        message: 'All elements in the Value array must be of the same type.',
        suggestion: 'Check that all array elements match the expected type for this operator.'
      });
    });

    it('returns null for non-matching error', () => {
      const error = 'Some other error message';

      const result = parsePolicyConditionError(error);

      expect(result).toBeNull();
    });

    it('handles default case with unrecognized reason', () => {
      const error = 'Policy condition validation failed for key="test", operator="TestOp": Unknown error reason';

      const result = parsePolicyConditionError(error);

      expect(result).toEqual({
        title: 'Condition Validation Error',
        message: 'Error with condition: Key="test", Operator="TestOp"',
        suggestion: 'Unknown error reason'
      });
    });
  });

  describe('parseUrnValidationError', () => {
    it('parses invalid URN format error', () => {
      const error = 'Invalid URN format. Expected: urn:<submission_id>:<feature_type_name>:<submission_feature_id>';

      const result = parseUrnValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Resource URN',
        message: 'The Resource URN format is invalid.',
        suggestion: 'Use the format: urn:<submissionId>:<featureType>:<featureId> (use * for wildcards).'
      });
    });

    it('parses submission_id does not exist error', () => {
      const error = 'Invalid submission_feature_urn: submission_id 999 does not exist';

      const result = parseUrnValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Submission',
        message: 'Submission ID 999 does not exist.',
        suggestion: 'Select a valid submission ID from the autocomplete suggestions, or use * for all submissions.'
      });
    });

    it('parses feature_type_name does not exist error', () => {
      const error = 'Invalid submission_feature_urn: feature_type_name invalid_type does not exist';

      const result = parseUrnValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Feature Type',
        message: 'Feature type "invalid_type" does not exist.',
        suggestion: 'Select a valid feature type from the autocomplete suggestions, or use * for all types.'
      });
    });

    it('parses submission_feature_id does not exist error', () => {
      const error = 'Invalid submission_feature_urn: submission_feature_id 12345 does not exist';

      const result = parseUrnValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Feature ID',
        message: 'Feature ID 12345 does not exist.',
        suggestion: 'Select a valid feature ID from the autocomplete suggestions, or use * for all features.'
      });
    });

    it('parses feature type mismatch error', () => {
      const error = 'Invalid submission_feature_urn: submission_feature_id 123 does not have feature_type telemetry';

      const result = parseUrnValidationError(error);

      expect(result).toEqual({
        title: 'Feature Type Mismatch',
        message: 'Feature ID 123 is not of type "telemetry".',
        suggestion: 'Ensure the feature ID belongs to the specified feature type, or use * for wildcards.'
      });
    });

    it('returns null for non-matching error', () => {
      const error = 'Some other error message';

      const result = parseUrnValidationError(error);

      expect(result).toBeNull();
    });
  });

  describe('parseSchemaValidationError', () => {
    it('parses enum validation error', () => {
      const error = 'must be equal to one of the allowed values';

      const result = parseSchemaValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Value',
        message: 'The value entered is not one of the allowed options.',
        suggestion: 'Use the autocomplete suggestions to select a valid value for this field.'
      });
    });

    it('parses pattern validation error', () => {
      const error = 'must match pattern "^urn:.*"';

      const result = parseSchemaValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Format',
        message: 'The value does not match the required format.',
        suggestion: 'Check the format and use autocomplete suggestions where available.'
      });
    });

    it('parses required property error', () => {
      const error = "must have required property 'Effect'";

      const result = parseSchemaValidationError(error);

      expect(result).toEqual({
        title: 'Missing Required Field',
        message: 'The field "Effect" is required.',
        suggestion: 'Add the "Effect" field to your policy document.'
      });
    });

    it('parses additional properties error', () => {
      const error = 'must NOT have additional properties';

      const result = parseSchemaValidationError(error);

      expect(result).toEqual({
        title: 'Unknown Field',
        message: 'The policy contains an unrecognized field.',
        suggestion:
          'Remove any fields that are not part of the policy schema (Version, Statement, Effect, Resource, Condition, Operator, Key, Value).'
      });
    });

    it('returns null for non-matching error', () => {
      const error = 'Some other error message';

      const result = parseSchemaValidationError(error);

      expect(result).toBeNull();
    });
  });

  describe('parsePolicyError', () => {
    it('parses condition validation error from message', () => {
      const error = {
        message:
          'Policy condition validation failed for key="sex", operator="DateAfter": Operator "DateAfter" not valid for property type "string". Valid operators: StringEquals, StringNotEquals, StringLike, Exists'
      };

      const result = parsePolicyError(error);

      expect(result.title).toBe('Incompatible Operator');
    });

    it('parses error from errors array with message property', () => {
      const error = {
        message: 'Failed to execute SQL',
        errors: [
          {
            name: 'error',
            message:
              'Policy condition validation failed for key="geometry", operator="Contains": Spatial operator Contains requires a GeoJSON object, got: string'
          }
        ]
      };

      const result = parsePolicyError(error);

      expect(result.title).toBe('Invalid GeoJSON');
      expect(result.message).toBe('The Contains operator requires a valid GeoJSON geometry object.');
    });

    it('parses error from errors array with string element', () => {
      const error = {
        message: 'Validation failed',
        errors: ['must be equal to one of the allowed values']
      };

      const result = parsePolicyError(error);

      expect(result.title).toBe('Invalid Value');
    });

    it('returns default error for unrecognized message', () => {
      const error = {
        message: 'Something unexpected happened'
      };

      const result = parsePolicyError(error);

      expect(result).toEqual({
        title: 'Policy Error',
        message: 'Something unexpected happened',
        suggestion: 'Please check your policy configuration and try again.'
      });
    });

    it('returns default error for empty error object', () => {
      const error = {};

      const result = parsePolicyError(error);

      expect(result).toEqual({
        title: 'Policy Error',
        message: 'An unexpected error occurred while saving the policy.',
        suggestion: 'Please check your policy configuration and try again.'
      });
    });

    it('parses URN validation error', () => {
      const error = {
        message: 'Invalid submission_feature_urn: submission_id 999 does not exist'
      };

      const result = parsePolicyError(error);

      expect(result.title).toBe('Invalid Submission');
    });

    it('parses schema validation error', () => {
      const error = {
        message: 'must be equal to one of the allowed values'
      };

      const result = parsePolicyError(error);

      expect(result.title).toBe('Invalid Value');
    });
  });
});
