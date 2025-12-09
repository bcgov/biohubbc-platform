import { Policy } from '../../models/policy';
import { PolicyEffect, PolicyStatement } from '../../models/policy-statement';
import { PolicyConditionOperator, PolicyStatementCondition } from '../../models/policy-statement-condition';

/**
 * A policy statement with its conditions.
 */
export interface PolicyStatementWithConditions extends PolicyStatement {
  conditions: PolicyStatementCondition[];
}

/**
 * A policy with its statements and conditions.
 */
export interface PolicyWithStatements extends Policy {
  statements: PolicyStatementWithConditions[];
}

/**
 * Input for creating a policy statement with conditions.
 */
export interface CreatePolicyStatementInput {
  effect: PolicyEffect;
  submission_feature_urn: string;
  conditions?: {
    operator: PolicyConditionOperator;
    key: string;
    value: unknown;
  }[];
}
