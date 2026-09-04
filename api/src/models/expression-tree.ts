import { z } from 'zod';
import { PredicateOperator } from './expression-predicate';
import { LogicalOperator } from './logical-operator';

export type ExpressionTreePredicate = {
  type: 'predicate';
  feature_property_id: number;
  feature_type_property_id: number | null;
  operator: PredicateOperator;
  value?: unknown;
};

export type ExpressionTree = {
  type: 'expression';
  operator: LogicalOperator;
  clauses: ExpressionTreeClause[];
};

export type ExpressionTreeClause = ExpressionTree | ExpressionTreePredicate;

/**
 * Expression-tree leaf node that binds a property to an operator and scalar value.
 *
 * Operator/value compatibility depends on database property metadata and is
 * therefore validated by the service layer.
 */
export const ExpressionTreePredicate: z.ZodType<ExpressionTreePredicate> = z
  .object({
    type: z.literal('predicate'),
    feature_property_id: z.number().int().positive(),
    feature_type_property_id: z.number().int().positive().nullable(),
    operator: PredicateOperator,
    value: z.unknown().optional()
  })
  .strict();

/**
 * Recursive clause node used for nested expression composition.
 */
export const ExpressionTreeClause: z.ZodType<ExpressionTreeClause> = z.lazy(() =>
  z.union([ExpressionTree, ExpressionTreePredicate])
);

/**
 * Recursive expression tree composed of one or more clauses.
 */
export const ExpressionTree: z.ZodType<ExpressionTree> = z.lazy(() =>
  z
    .object({
      type: z.literal('expression'),
      operator: LogicalOperator,
      clauses: z.array(ExpressionTreeClause).min(1)
    })
    .strict()
);
