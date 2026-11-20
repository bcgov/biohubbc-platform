import { z } from 'zod';

export const ExpressionClause = z.object({
  expression_clause_id: z.guid(),
  expression_id: z.guid(),
  sequence: z.number().int().positive(),
  predicate_id: z.guid().nullable(),
  child_expression_id: z.guid().nullable()
});

export const CreateExpressionClause = ExpressionClause.pick({
  expression_id: true,
  sequence: true,
  predicate_id: true,
  child_expression_id: true
});

export type ExpressionClause = z.infer<typeof ExpressionClause>;
export type CreateExpressionClause = z.infer<typeof CreateExpressionClause>;
