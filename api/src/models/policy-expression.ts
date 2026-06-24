import { z } from 'zod';

/**
 * Policy-owned expression identity.
 */
export const PolicyExpression = z.object({
  policy_expression_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  expression_id: z.string().uuid(),
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
