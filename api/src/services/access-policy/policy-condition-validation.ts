import { HTTP400 } from '../../errors/http-error';
import { FeaturePropertyTypeName } from '../../models/feature-property';
import { PolicyConditionOperator } from '../../models/policy-statement-condition';

type PolicyValue = unknown;

const ALLOWED_OPERATORS_BY_PROPERTY_TYPE: Record<string, PolicyConditionOperator[]> = {
  string: [
    PolicyConditionOperator.STRING_EQUALS,
    PolicyConditionOperator.STRING_NOT_EQUALS,
    PolicyConditionOperator.STRING_LIKE,
    PolicyConditionOperator.EXISTS
  ],
  number: [PolicyConditionOperator.NUMERIC_EQUALS, PolicyConditionOperator.EXISTS],
  timestamp: [PolicyConditionOperator.DATE_BEFORE, PolicyConditionOperator.DATE_AFTER, PolicyConditionOperator.EXISTS],
  datetime: [PolicyConditionOperator.DATE_BEFORE, PolicyConditionOperator.DATE_AFTER, PolicyConditionOperator.EXISTS],
  geometry: [
    PolicyConditionOperator.WITHIN,
    PolicyConditionOperator.INTERSECTS,
    PolicyConditionOperator.CONTAINS,
    PolicyConditionOperator.EXISTS
  ],
  spatial: [
    PolicyConditionOperator.WITHIN,
    PolicyConditionOperator.INTERSECTS,
    PolicyConditionOperator.CONTAINS,
    PolicyConditionOperator.EXISTS
  ],
  boolean: [PolicyConditionOperator.BOOL, PolicyConditionOperator.EXISTS],
  object: [PolicyConditionOperator.EXISTS],
  array: [PolicyConditionOperator.EXISTS],
  code: [PolicyConditionOperator.EXISTS],
  taxon: [PolicyConditionOperator.EXISTS],
  artifact_key: [
    PolicyConditionOperator.STRING_EQUALS,
    PolicyConditionOperator.STRING_NOT_EQUALS,
    PolicyConditionOperator.STRING_LIKE,
    PolicyConditionOperator.EXISTS
  ]
};

const DATE_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.DATE_BEFORE,
  PolicyConditionOperator.DATE_AFTER
]);

const STRING_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.STRING_EQUALS,
  PolicyConditionOperator.STRING_NOT_EQUALS,
  PolicyConditionOperator.STRING_LIKE
]);

const SPATIAL_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.WITHIN,
  PolicyConditionOperator.INTERSECTS,
  PolicyConditionOperator.CONTAINS
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function assertCondition(message: string, condition: boolean): void {
  if (!condition) {
    throw new HTTP400(message);
  }
}

export function validatePolicyConditionInput(
  key: string,
  operator: PolicyConditionOperator,
  value: PolicyValue,
  propertyTypeName: FeaturePropertyTypeName | 'datetime' | 'spatial' | 'array'
): void {
  const allowedOperators = ALLOWED_OPERATORS_BY_PROPERTY_TYPE[propertyTypeName];

  assertCondition(`Unknown property type: ${propertyTypeName}`, !!allowedOperators);
  assertCondition(
    `Operator ${operator} is not valid for property type ${propertyTypeName}`,
    allowedOperators.includes(operator)
  );

  if (operator === PolicyConditionOperator.BOOL || operator === PolicyConditionOperator.EXISTS) {
    assertCondition(`${operator} operator requires a boolean value`, typeof value === 'boolean');
    return;
  }

  if (operator === PolicyConditionOperator.NUMERIC_EQUALS) {
    const isValidNumber = typeof value === 'number' && Number.isFinite(value);
    assertCondition('NumericEquals requires a number or array of numbers', isValidNumber || isNumberArray(value));
    return;
  }

  if (STRING_OPERATORS.has(operator)) {
    assertCondition(
      `${operator} requires a string or array of strings`,
      typeof value === 'string' || isStringArray(value)
    );
    return;
  }

  if (DATE_OPERATORS.has(operator)) {
    assertCondition(
      `${operator} requires a date string or array of date strings`,
      typeof value === 'string' || isStringArray(value)
    );
    return;
  }

  if (SPATIAL_OPERATORS.has(operator)) {
    assertCondition(`${operator} requires a GeoJSON-like object value`, isObject(value));
    assertCondition(`${operator} requires a GeoJSON-like object with a "type" field`, isObject(value) && typeof value.type === 'string');
    return;
  }

  throw new HTTP400(`Unsupported policy condition operator: ${operator} for key ${key}`);
}
