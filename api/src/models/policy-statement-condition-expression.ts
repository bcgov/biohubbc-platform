import { z } from 'zod';

/**
 * Join model linking a policy statement condition to an expression.
 *
 * Supports policy evaluation using shared expression-tree semantics.
 */
export const PolicyStatementConditionExpression = z.object({
  policy_statement_condition_expression_id: z.string().uuid(),
  policy_statement_condition_id: z.string().uuid(),
  expression_id: z.string().uuid()
});

export type PolicyStatementConditionExpression = z.infer<typeof PolicyStatementConditionExpression>;

export interface CreatePolicyStatementConditionExpression {
  policy_statement_condition_id: string;
  expression_id: string;
}
