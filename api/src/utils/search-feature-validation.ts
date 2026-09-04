import { HTTP400 } from '../errors/http-error';
import { ExpressionTree } from '../models/expression-tree';

/**
 * Validates and normalizes a feature type.
 *
 * @param {unknown} featureType - Feature type value to validate.
 * @returns {string} Trimmed, lowercase feature type.
 * @throws {HTTP400} When the value is not a non-empty string.
 */
export const validateSearchFeatureType = (featureType: unknown): string => {
  const normalized = typeof featureType === 'string' ? featureType.trim().toLowerCase() : '';

  if (!normalized) {
    throw new HTTP400('Feature type is required');
  }

  return normalized;
};

/**
 * Validates an optional expression tree.
 *
 * @param {unknown} expression - Expression value to validate.
 * @returns {ExpressionTree | undefined} Validated expression tree, or undefined when omitted.
 * @throws {HTTP400} When the supplied expression does not match the expression-tree schema.
 */
export const validateSearchExpressionTree = (expression: unknown): ExpressionTree | undefined => {
  if (expression === undefined) {
    return undefined;
  }

  const result = ExpressionTree.safeParse(expression);

  if (!result.success) {
    throw new HTTP400('Invalid expression tree', result.error.issues);
  }

  return result.data;
};
