import { Request } from 'express';
import { HTTP400 } from '../errors/http-error';
import { ExpressionTree } from '../models/expression-tree';

/**
 * Returns the normalized feature type from a feature-search request.
 *
 * @param {Request} request - Express request containing the feature type path parameter.
 * @returns {string} Trimmed, lowercase feature type.
 * @throws {HTTP400} When the path parameter is missing or contains only whitespace.
 */
export const getSearchFeatureType = (request: Request): string => {
  const featureType = request.params.feature_type?.trim().toLowerCase();

  if (!featureType) {
    throw new HTTP400('Feature type path parameter is required');
  }

  return featureType;
};

/**
 * Parses the optional expression tree from a feature-search request.
 *
 * @param {Request} request - Express request containing the optional expression body field.
 * @returns {ExpressionTree | undefined} Validated expression tree, or undefined when omitted.
 * @throws {HTTP400} When the supplied expression does not match the expression-tree schema.
 */
export const getSearchExpressionTree = (request: Request): ExpressionTree | undefined => {
  if (!request.body.expression) {
    return undefined;
  }

  const result = ExpressionTree.safeParse(request.body.expression);

  if (!result.success) {
    throw new HTTP400('Invalid expression tree', result.error.issues);
  }

  return result.data;
};
