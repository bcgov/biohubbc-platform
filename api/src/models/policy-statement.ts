import { z } from 'zod';
import { PolicyConditionOperator } from './policy-statement-condition';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny'
}

export const PolicyStatement = z.object({
  policy_statement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  effect: z.nativeEnum(PolicyEffect),
  submission_feature_urn: z.string().max(500)
});

export type PolicyStatement = z.infer<typeof PolicyStatement>;

export interface CreatePolicyStatement {
  policy_id: string;
  effect: PolicyEffect;
  submission_feature_urn: string;
}

export interface CreatePolicyStatementPayload {
  effect: PolicyEffect;
  submission_feature_urn: string;
  conditions?: {
    operator: PolicyConditionOperator;
    key: string;
    value: unknown;
  }[];
}

export interface UpdatePolicyStatement {
  policy_id?: string;
  effect?: PolicyEffect;
  submission_feature_urn?: string;
  record_end_date?: string;
}
