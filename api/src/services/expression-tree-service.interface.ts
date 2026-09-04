import type { Expression } from '../models/expression';
import type { ExpressionClause } from '../models/expression-clause';
import type { NormalizedExpressionTree, NormalizedExpressionTreePredicate } from '../models/expression-tree-internal';
import type { ReadPredicateNodeRow } from '../models/predicate';

export type HashedExpressionTreePredicate = NormalizedExpressionTreePredicate & {
  hash: string;
};

export type HashedExpressionTree = Omit<NormalizedExpressionTree, 'clauses'> & {
  hash: string;
  clauses: HashedExpressionTreeClause[];
};

export type HashedExpressionTreeClause = HashedExpressionTreePredicate | HashedExpressionTree;

export interface ExpressionTreeHydrationContext {
  expressionsById: Map<string, Expression>;
  clausesByExpressionId: Map<string, ExpressionClause[]>;
  predicateIds: Set<string>;
}

export interface ExpressionTreeReconstructionContext extends Omit<ExpressionTreeHydrationContext, 'predicateIds'> {
  predicatesById: Map<string, ReadPredicateNodeRow>;
}
