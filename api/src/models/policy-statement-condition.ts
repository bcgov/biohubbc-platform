import { z } from 'zod';

// Enum for policy condition operator
export enum PolicyConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUALS = 'GREATER_THAN_OR_EQUALS',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUALS = 'LESS_THAN_OR_EQUALS',
  STRING_LIKE = 'STRING_LIKE',
  STRING_NOT_LIKE = 'STRING_NOT_LIKE'
}

// Zod schema for full DB PolicyStatementCondition record
export const PolicyStatementCondition = z.object({
  policy_statement_condition_id: z.string().uuid(),
  policy_statement_id: z.string().uuid(),
  operator: z.nativeEnum(PolicyConditionOperator),
  key: z.string().max(500),
  value: z.any()
});

// TypeScript type inferred from Zod schema
export type PolicyStatementCondition = z.infer<typeof PolicyStatementCondition>;

// Plain TypeScript interface for creating a policy statement condition
export interface CreatePolicyStatementCondition {
  policy_statement_id: string;
  operator: PolicyConditionOperator;
  key: string;
  value: any;
}

// Plain TypeScript interface for updating a policy statement condition
export interface UpdatePolicyStatementCondition {
  policy_statement_id?: string;
  operator?: PolicyConditionOperator;
  key?: string;
  value?: any;
  record_end_date?: string;
}
