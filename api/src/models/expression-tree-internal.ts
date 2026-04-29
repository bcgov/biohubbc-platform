import type { PredicatePropertyTypeName } from '../constants/expression';
import type { InternalTypedPredicate } from './expression-predicate';
import type { ExpressionTreeExpression, ExpressionTreePredicate } from './expression-tree';

export type NormalizedExpressionTreePredicate = ExpressionTreePredicate & {
  feature_property_type_id: number;
  feature_property_type_name: PredicatePropertyTypeName;
  internal_predicate: InternalTypedPredicate;
};

export type NormalizedExpressionTreeExpression = Omit<ExpressionTreeExpression, 'clauses'> & {
  clauses: NormalizedExpressionTreeClause[];
};

export type NormalizedExpressionTreeClause = NormalizedExpressionTreePredicate | NormalizedExpressionTreeExpression;
