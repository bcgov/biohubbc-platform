import { z } from 'zod';
import { LogicalOperator } from './logical-operator';

/**
 * Database expression row schema.
 *
 * Model files export Zod objects for runtime parsing of repository rows and API payloads. The matching TypeScript type
 * is inferred from the Zod object below, which keeps database/API validation and compile-time usage synchronized.
 * This schema represents the persisted expression anchor only; recursive expression tree request/response shapes live
 * in `expression-tree.ts`.
 */
export const Expression = z.object({
  expression_id: z.string().uuid(),
  operator: LogicalOperator,
  expression_hash: z.string()
});

export type Expression = z.infer<typeof Expression>;

export const ResolvedExpressionAnchor = Expression.extend({
  inserted: z.boolean()
});

export type ResolvedExpressionAnchor = z.infer<typeof ResolvedExpressionAnchor>;
