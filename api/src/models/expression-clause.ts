import { z } from 'zod';

export const ExpressionClause = z.object({
  expression_clause_id: z.string().uuid(),
  expression_id: z.string().uuid(),
  sequence: z.number().int().positive(),
  predicate_id: z.string().uuid().nullable(),
  child_expression_id: z.string().uuid().nullable()
});

export const CreateExpressionClause = ExpressionClause.pick({
  expression_id: true,
  sequence: true,
  predicate_id: true,
  child_expression_id: true
});

export type ExpressionClause = z.infer<typeof ExpressionClause>;
export type CreateExpressionClause = z.infer<typeof CreateExpressionClause>;
