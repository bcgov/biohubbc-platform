import { z } from 'zod';
import { LogicalOperator } from './logical-operator';

export const Expression = z.object({
  expression_id: z.string().uuid(),
  operator: LogicalOperator,
  expression_hash: z.string()
});

export type Expression = z.infer<typeof Expression>;
