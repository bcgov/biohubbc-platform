import { expect } from 'chai';
import { describe, it } from 'mocha';
import { HTTP400 } from '../../errors/http-error';
import { PolicyConditionOperator } from '../../models/policy-statement-condition';
import { validatePolicyConditionInput } from './policy-condition-validation';

describe('validatePolicyConditionInput', () => {
  it('accepts valid string operators and values', () => {
    validatePolicyConditionInput('region', PolicyConditionOperator.STRING_EQUALS, 'north', 'string');
    validatePolicyConditionInput('region', PolicyConditionOperator.STRING_LIKE, ['north', 'south'], 'string');
  });

  it('rejects invalid string value shape', () => {
    expect(() =>
      validatePolicyConditionInput('region', PolicyConditionOperator.STRING_EQUALS, 42, 'string')
    ).to.throw(HTTP400);
  });

  it('accepts valid numeric equals values', () => {
    validatePolicyConditionInput('count', PolicyConditionOperator.NUMERIC_EQUALS, 3, 'number');
    validatePolicyConditionInput('count', PolicyConditionOperator.NUMERIC_EQUALS, [1, 2, 3], 'number');
  });

  it('rejects invalid numeric equals values', () => {
    expect(() =>
      validatePolicyConditionInput('count', PolicyConditionOperator.NUMERIC_EQUALS, ['1', '2'], 'number')
    ).to.throw(HTTP400);
  });

  it('accepts valid boolean operators', () => {
    validatePolicyConditionInput('is_public', PolicyConditionOperator.BOOL, true, 'boolean');
    validatePolicyConditionInput('is_public', PolicyConditionOperator.EXISTS, false, 'boolean');
  });

  it('rejects invalid boolean operator values', () => {
    expect(() =>
      validatePolicyConditionInput('is_public', PolicyConditionOperator.EXISTS, 'true', 'boolean')
    ).to.throw(HTTP400);
  });

  it('accepts valid date operators', () => {
    validatePolicyConditionInput('start_date', PolicyConditionOperator.DATE_BEFORE, '2024-01-01', 'timestamp');
    validatePolicyConditionInput('start_date', PolicyConditionOperator.DATE_AFTER, ['2024-01-01', '2024-02-01'], 'timestamp');
  });

  it('rejects invalid date payloads', () => {
    expect(() =>
      validatePolicyConditionInput('start_date', PolicyConditionOperator.DATE_BEFORE, [1, 2], 'timestamp')
    ).to.throw(HTTP400);
  });

  it('accepts valid spatial operator payloads', () => {
    validatePolicyConditionInput(
      'geometry',
      PolicyConditionOperator.WITHIN,
      { type: 'Polygon', coordinates: [] },
      'geometry'
    );
  });

  it('rejects invalid spatial payloads', () => {
    expect(() =>
      validatePolicyConditionInput('geometry', PolicyConditionOperator.WITHIN, 'polygon', 'geometry')
    ).to.throw(HTTP400);

    expect(() =>
      validatePolicyConditionInput('geometry', PolicyConditionOperator.WITHIN, { coordinates: [] }, 'geometry')
    ).to.throw(HTTP400);
  });

  it('rejects invalid operator for property type', () => {
    expect(() =>
      validatePolicyConditionInput('count', PolicyConditionOperator.WITHIN, { type: 'Polygon' }, 'number')
    ).to.throw(HTTP400);
  });
});
