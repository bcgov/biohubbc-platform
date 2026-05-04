import type { ExpressionTreeClause } from '../models/expression-tree';
import type {
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';

export type ReadExpressionClause = {
  sequence: number;
  clause: ExpressionTreeClause;
};

export type WriteExpressionClause = {
  sequence: number;
  predicate_id: string | null;
  child_expression_id: string | null;
};

export type ExpressionHashClause = {
  sequence: number;
  clause_type: 'predicate' | 'expression';
  clause_hash: string;
};

export type ExpressionTreePredicateWithHash = NormalizedExpressionTreePredicate & {
  hash: string;
};

export type ExpressionTreeExpressionWithHash = Omit<NormalizedExpressionTreeExpression, 'clauses'> & {
  hash: string;
  clauses: ExpressionTreeClauseWithHash[];
};

export type ExpressionTreeClauseWithHash = ExpressionTreePredicateWithHash | ExpressionTreeExpressionWithHash;
