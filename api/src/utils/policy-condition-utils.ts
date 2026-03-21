import { PolicyConditionOperator } from '../models/policy-statement-condition';

export const ALLOWED_OPERATORS_BY_PROPERTY_TYPE: Record<string, PolicyConditionOperator[]> = {
  string: [
    PolicyConditionOperator.STRING_EQUALS,
    PolicyConditionOperator.STRING_NOT_EQUALS,
    PolicyConditionOperator.STRING_LIKE,
    PolicyConditionOperator.EXISTS
  ],
  number: [PolicyConditionOperator.NUMERIC_EQUALS, PolicyConditionOperator.EXISTS],
  timestamp: [PolicyConditionOperator.DATE_BEFORE, PolicyConditionOperator.DATE_AFTER, PolicyConditionOperator.EXISTS],
  geometry: [
    PolicyConditionOperator.WITHIN,
    PolicyConditionOperator.INTERSECTS,
    PolicyConditionOperator.CONTAINS,
    PolicyConditionOperator.EXISTS
  ],
  boolean: [PolicyConditionOperator.BOOL, PolicyConditionOperator.EXISTS],
  object: [PolicyConditionOperator.EXISTS],
  code: [PolicyConditionOperator.EXISTS],
  taxon: [PolicyConditionOperator.EXISTS],
  artifact_key: [
    PolicyConditionOperator.STRING_EQUALS,
    PolicyConditionOperator.STRING_NOT_EQUALS,
    PolicyConditionOperator.STRING_LIKE,
    PolicyConditionOperator.EXISTS
  ]
};

export const DATE_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.DATE_BEFORE,
  PolicyConditionOperator.DATE_AFTER
]);

export const STRING_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.STRING_EQUALS,
  PolicyConditionOperator.STRING_NOT_EQUALS,
  PolicyConditionOperator.STRING_LIKE
]);

export const SPATIAL_OPERATORS = new Set<PolicyConditionOperator>([
  PolicyConditionOperator.WITHIN,
  PolicyConditionOperator.INTERSECTS,
  PolicyConditionOperator.CONTAINS
]);

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}
