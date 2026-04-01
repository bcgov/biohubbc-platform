import { z } from 'zod';
import { LogicalOperator } from './logical-operator';

export const Expression = z.object({
  expression_id: z.string().uuid(),
  operator: LogicalOperator
});

export const ExpressionHashRow = z.object({
  expression_id: z.string().uuid(),
  expression_hash: z.string()
});

export type Expression = z.infer<typeof Expression>;
export type ExpressionHashRow = z.infer<typeof ExpressionHashRow>;
