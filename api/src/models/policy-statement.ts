import { z } from 'zod';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny'
}

export const PolicyStatement = z.object({
  policy_statement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  effect: z.nativeEnum(PolicyEffect),
  security_scope_id: z.string().uuid(),
  submission_feature_urn: z.string().max(500),
  policy_expression_id: z.string().nullable()
});

export type PolicyStatement = z.infer<typeof PolicyStatement>;

export interface CreatePolicyStatement {
  policy_id: string;
  effect: PolicyEffect;
  submission_feature_urn: string;
  policy_expression_id?: string | null;
}

export interface CreatePolicyStatementRecord {
  policy_id: string;
  effect: PolicyEffect;
  security_scope_id: string;
  policy_expression_id?: string | null;
}

export interface CreatePolicyStatementPayload {
  effect: PolicyEffect;
  submission_feature_urn: string;
  policy_expression_id?: string | null;
}

export interface UpdatePolicyStatement {
  policy_id?: string;
  effect?: PolicyEffect;
  submission_feature_urn?: string;
  policy_expression_id?: string | null;
  record_end_date?: string;
}

export interface UpdatePolicyStatementRecord {
  policy_id?: string;
  effect?: PolicyEffect;
  security_scope_id?: string;
  policy_expression_id?: string | null;
  record_end_date?: string;
}
