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

/** Most suggestion chips of each kind (properties, species) the expression builder shows at once. */
export const EXPRESSION_BUILDER_MAX_SUGGESTIONS_PER_CATEGORY = 6;

/** Page size of the property searches behind expression-builder pickers. */
export const EXPRESSION_BUILDER_PROPERTY_SEARCH_LIMIT = 25;

/** Most pages fetched to find the definitions of properties a draft expression already uses. */
export const EXPRESSION_BUILDER_PROPERTY_HYDRATION_MAX_PAGES = 20;
