import { z } from 'zod';
import { PolicyEffect } from './policy-statement';
import { PolicyConditionOperator } from './policy-statement-condition';

export const Policy = z.object({
  policy_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(1000).nullable()
});

export type Policy = z.infer<typeof Policy>;

export interface CreatePolicy {
  name: string;
  description?: string;
}

export interface UpdatePolicy {
  name?: string;
  description?: string;
  record_end_date?: string;
}

export interface PolicyStatementRequest {
  effect: PolicyEffect;
  submission_feature_urn: string;
  conditions?: {
    operator: PolicyConditionOperator;
    key: string;
    value: unknown;
  }[];
}

export interface CreatePolicyRequest {
  name: string;
  description?: string;
  statements: PolicyStatementRequest[];
}

export interface UpdatePolicyRequest {
  name: string;
  description?: string;
  statements: PolicyStatementRequest[];
}
