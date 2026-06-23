import { z } from 'zod';

/**
 * Join model linking a policy statement to a policy-owned expression.
 */
export const PolicyStatementExpression = z.object({
  policy_statement_expression_id: z.string().uuid(),
  policy_statement_id: z.string().uuid(),
  policy_expression_id: z.string().uuid()
});

export const PolicyStatementExpressionWithExpression = PolicyStatementExpression.extend({
  expression_id: z.string().uuid()
});

export type PolicyStatementExpression = z.infer<typeof PolicyStatementExpression>;
export type PolicyStatementExpressionWithExpression = z.infer<typeof PolicyStatementExpressionWithExpression>;

export const CreatePolicyStatementExpression = PolicyStatementExpression.pick({
  policy_statement_id: true,
  policy_expression_id: true
});

export type CreatePolicyStatementExpression = z.infer<typeof CreatePolicyStatementExpression>;
