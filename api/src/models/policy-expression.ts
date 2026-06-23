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

export const CreatePolicyExpression = PolicyExpression.pick({
  policy_id: true,
  expression_id: true
}).extend({
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

export type CreatePolicyExpression = z.infer<typeof CreatePolicyExpression>;
