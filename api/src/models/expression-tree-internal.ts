import type { InternalTypedPredicate, PredicatePropertyTypeName } from './expression-predicate';
import type { ExpressionTree, ExpressionTreePredicate } from './expression-tree';

export type NormalizedExpressionTreePredicate = ExpressionTreePredicate & {
  feature_property_type_id: number;
  feature_property_type_name: PredicatePropertyTypeName;
  internal_predicate: InternalTypedPredicate;
};

export type NormalizedExpressionTree = Omit<ExpressionTree, 'clauses'> & {
  clauses: NormalizedExpressionTreeClause[];
};

export type NormalizedExpressionTreeClause = NormalizedExpressionTreePredicate | NormalizedExpressionTree;
