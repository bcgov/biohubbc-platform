import { z } from 'zod';

/**
 * Policy-owned expression identity.
 */
export const PolicyExpression = z.object({
  policy_expression_id: z.guid(),
  policy_id: z.guid(),
  expression_id: z.guid(),
  name: z.string().nullable(),
  description: z.string().nullable()
});

export type PolicyExpression = z.infer<typeof PolicyExpression>;

export type CreatePolicyExpression = {
  policyId: string;
  expressionId: string;
  name?: string | null;
  description?: string | null;
};

export type UpdatePolicyExpression = {
  expressionId: string;
};

export type UpdatePolicyExpressionForPolicy = {
  expression_id: string;
  name?: string | null;
  description?: string | null;
};
