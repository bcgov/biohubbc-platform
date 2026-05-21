export type ExpressionLogicalOperator = 'AND' | 'OR';

/**
 * Canonical list of API predicate operators for feature search expressions.
 * Single source of truth for the `ExpressionPredicateOperator` union and runtime checks.
 */
export const EXPRESSION_PREDICATE_OPERATORS = [
  'Equals',
  'NotEquals',
  'Like',
  'ILike',
  'StartsWith',
  'EndsWith',
  'Contains',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
  'Before',
  'After',
  'OnDate',
  'OnTime',
  'ParentOf',
  'ChildOf',
  'DescendsFrom',
  'AscendsFrom',
  'Within',
  'Intersects',
  'Exists'
] as const;

export type ExpressionPredicateOperator = (typeof EXPRESSION_PREDICATE_OPERATORS)[number];

export type ExpressionPropertyType = 'string' | 'number' | 'boolean' | 'datetime' | 'taxon' | 'spatial' | 'code';

export interface ExpressionTreeExpression {
  type: 'expression';
  operator: ExpressionLogicalOperator;
  clauses: ExpressionTreeClause[];
}

export type ExpressionTreeClause = ExpressionTreeExpression | ExpressionTreePredicate;

export interface ExpressionTreePredicate {
  type: 'predicate';
  feature_property_id: number;
  feature_type_property_id: number | null;
  operator: ExpressionPredicateOperator;
  value?: unknown;
}
