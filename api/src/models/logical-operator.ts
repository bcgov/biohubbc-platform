import { z } from 'zod';

/**
 * Boolean operator used to connect sibling expression clauses.
 */
export const LogicalOperator = z.enum(['AND', 'OR']);
export type LogicalOperator = z.infer<typeof LogicalOperator>;
