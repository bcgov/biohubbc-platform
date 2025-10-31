import { z } from 'zod';

// Enum for policy effect
export enum PolicyEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY'
}

// Zod schema for full DB PolicyStatement record
export const PolicyStatement = z.object({
  policy_statement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  effect: z.nativeEnum(PolicyEffect),
  submission_feature_urn: z.string().max(500)
});

// TypeScript type inferred from Zod schema
export type PolicyStatement = z.infer<typeof PolicyStatement>;

// Plain TypeScript interface for creating a policy statement
export interface CreatePolicyStatement {
  policy_id: string;
  effect: PolicyEffect;
  submission_feature_urn: string;
}

// Plain TypeScript interface for updating a policy statement
export interface UpdatePolicyStatement {
  policy_id?: string;
  effect?: PolicyEffect;
  submission_feature_urn?: string;
  record_end_date?: string;
}
