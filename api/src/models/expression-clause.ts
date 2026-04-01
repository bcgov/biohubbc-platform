import { z } from 'zod';

export const ExpressionClause = z.object({
  expression_clause_id: z.string().uuid(),
  expression_id: z.string().uuid(),
  sequence: z.number().int().positive(),
  predicate_id: z.string().uuid().nullable(),
  child_expression_id: z.string().uuid().nullable()
});

export const CreateExpressionClause = z.object({
  expression_id: z.string().uuid(),
  sequence: z.number().int().positive(),
  predicate_id: z.string().uuid().nullable(),
  child_expression_id: z.string().uuid().nullable()
});

export type ExpressionClause = z.infer<typeof ExpressionClause>;
export type CreateExpressionClause = z.infer<typeof CreateExpressionClause>;
