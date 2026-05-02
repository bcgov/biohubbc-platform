export type ExpressionLogicalOperator = 'AND' | 'OR';

export type ExpressionPredicateOperator =
  | 'Equals'
  | 'NotEquals'
  | 'Like'
  | 'ILike'
  | 'StartsWith'
  | 'EndsWith'
  | 'Contains'
  | 'GreaterThan'
  | 'GreaterThanOrEqual'
  | 'LessThan'
  | 'LessThanOrEqual'
  | 'Before'
  | 'After'
  | 'OnDate'
  | 'OnTime'
  | 'ParentOf'
  | 'ChildOf'
  | 'DescendsFrom'
  | 'AscendsFrom'
  | 'Within'
  | 'Intersects'
  | 'Exists';

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
