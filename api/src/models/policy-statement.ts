import { z } from 'zod';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny'
}

export const PolicyStatement = z.object({
  policy_statement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  effect: z.nativeEnum(PolicyEffect),
  submission_feature_urn: z.string().max(500),
  policy_expression_id: z.string().nullable()
});

export type PolicyStatement = z.infer<typeof PolicyStatement>;

/**
 * Picked shape for queries that return only the statement identity and its URN target.
 * Used by the security-scope materialization path — the scope cache only needs to know
 * which statement is being materialized and which feature URN it grants access to.
 */
export const PolicyStatementUrn = PolicyStatement.pick({
  policy_statement_id: true,
  submission_feature_urn: true
});
export type PolicyStatementUrn = z.infer<typeof PolicyStatementUrn>;

export interface CreatePolicyStatement {
  policy_id: string;
  effect: PolicyEffect;
  submission_feature_urn: string;
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
