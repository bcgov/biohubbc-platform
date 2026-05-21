import { z } from 'zod';

/**
 * Join model linking a policy statement directly to a root expression.
 */
export const PolicyStatementExpression = z.object({
  policy_statement_expression_id: z.string().uuid(),
  policy_statement_id: z.string().uuid(),
  expression_id: z.string().uuid()
});

export type PolicyStatementExpression = z.infer<typeof PolicyStatementExpression>;

export const CreatePolicyStatementExpression = PolicyStatementExpression.pick({
  policy_statement_id: true,
  expression_id: true
});

export type CreatePolicyStatementExpression = z.infer<typeof CreatePolicyStatementExpression>;
