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

export type ExpressionTreeExpression = {
  type: 'expression';
  operator: LogicalOperator;
  clauses: ExpressionTreeClause[];
};

export type ExpressionTreeClause = ExpressionTreeExpression | ExpressionTreePredicate;

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
  z.union([ExpressionTreeExpression, ExpressionTreePredicate])
);

/**
 * Recursive expression node composed of one or more expression-tree clauses.
 */
export const ExpressionTreeExpression: z.ZodType<ExpressionTreeExpression> = z.lazy(() =>
  z
    .object({
      type: z.literal('expression'),
      operator: LogicalOperator,
      clauses: z.array(ExpressionTreeClause).min(1)
    })
    .strict()
);

/**
 * Canonical root alias for expression trees.
 */
export const ExpressionTree = ExpressionTreeExpression;
export type ExpressionTree = z.infer<typeof ExpressionTree>;
