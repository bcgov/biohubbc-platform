import { PredicateOperator } from '../../models/expression-predicate';
import { ExpressionTree, ExpressionTreeClause, ExpressionTreePredicate } from '../../models/expression-tree';

// Builders for public expression trees used by the expression evaluation suites.

/**
 * Build a public expression predicate over any assignment of a property.
 *
 * @param {number} featurePropertyId Property the predicate reads.
 * @param {PredicateOperator} operator Predicate operator.
 * @param {unknown} [value] Comparison value; omitted for `Exists`.
 * @returns {ExpressionTreePredicate} Expression predicate.
 */
export function predicate(
  featurePropertyId: number,
  operator: PredicateOperator,
  value?: unknown
): ExpressionTreePredicate {
  return {
    type: 'predicate',
    feature_property_id: featurePropertyId,
    blueprint_feature_type_property_id: null,
    operator,
    ...(value === undefined ? {} : { value })
  };
}

/**
 * Wrap clauses in an AND expression.
 *
 * @param {ExpressionTreeClause[]} clauses Clauses every match must satisfy.
 * @returns {ExpressionTree} Expression tree.
 */
export function allOf(...clauses: ExpressionTreeClause[]): ExpressionTree {
  return { type: 'expression', operator: 'AND', clauses };
}

/**
 * Wrap clauses in an OR expression.
 *
 * @param {ExpressionTreeClause[]} clauses Clauses any match must satisfy.
 * @returns {ExpressionTree} Expression tree.
 */
export function anyOf(...clauses: ExpressionTreeClause[]): ExpressionTree {
  return { type: 'expression', operator: 'OR', clauses };
}
