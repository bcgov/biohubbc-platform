import { z } from 'zod';

export enum PolicyConditionOperator {
  STRING_EQUALS = 'StringEquals',
  STRING_NOT_EQUALS = 'StringNotEquals',
  STRING_LIKE = 'StringLike',
  NUMERIC_EQUALS = 'NumericEquals',
  BOOL = 'Bool',
  EXISTS = 'Exists',
  DATE_BEFORE = 'DateBefore',
  DATE_AFTER = 'DateAfter',
  WITHIN = 'Within',
  INTERSECTS = 'Intersects',
  CONTAINS = 'Contains',
  PARENT_OF = 'ParentOf',
  CHILD_OF = 'ChildOf'
}

export const PolicyStatementCondition = z.object({
  policy_statement_condition_id: z.string().uuid(),
  policy_statement_id: z.string().uuid(),
  operator: z.nativeEnum(PolicyConditionOperator),
  key: z.string().max(500),
  value: z.any()
});

export type PolicyStatementCondition = z.infer<typeof PolicyStatementCondition>;

export interface CreatePolicyStatementCondition {
  policy_statement_id: string;
  operator: PolicyConditionOperator;
  key: string;
  value: any;
}
