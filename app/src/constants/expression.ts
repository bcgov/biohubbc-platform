import { ExpressionPredicateOperator } from 'interfaces/expression.interface';

export const MAX_EXPRESSION_BUILDER_NESTED_GROUP_DEPTH = 10;

export const EXPRESSION_BUILDER_PREDICATE_OPERATOR_LABELS: Partial<Record<ExpressionPredicateOperator, string>> = {
  Equals: 'equals',
  NotEquals: 'does not equal',
  Like: 'matches',
  ILike: 'contains, case-insensitive',
  StartsWith: 'starts with',
  EndsWith: 'ends with',
  Contains: 'contains',
  GreaterThan: 'is greater than',
  GreaterThanOrEqual: 'is at least',
  LessThan: 'is less than',
  LessThanOrEqual: 'is at most',
  Before: 'is before',
  After: 'is after',
  OnDate: 'is on date',
  OnTime: 'is at time',
  ParentOf: 'is parent of',
  ChildOf: 'is child of',
  DescendsFrom: 'descends from',
  AscendsFrom: 'ascends from',
  Within: 'is within',
  Intersects: 'intersects',
  Exists: 'exists'
};
