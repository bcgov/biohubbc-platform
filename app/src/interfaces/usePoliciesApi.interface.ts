/**
 * Policy with statements and conditions (API response).
 */
export interface IPolicy {
  policy_id: string;
  name: string;
  description: string | null;
  statements: IPolicyStatement[];
}

/**
 * Policy statement with conditions.
 */
export interface IPolicyStatement {
  policy_statement_id: string;
  policy_id: string;
  effect: 'allow' | 'deny';
  submission_feature_urn: string;
  conditions: IPolicyStatementCondition[];
}

/**
 * Policy statement condition.
 */
export interface IPolicyStatementCondition {
  policy_statement_condition_id: string;
  policy_statement_id: string;
  operator: string;
  key: string;
  value: unknown;
}

/**
 * Paginated policies response.
 */
export interface IPoliciesResponse {
  policies: IPolicy[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

/**
 * Create policy request payload.
 */
export interface ICreatePolicyRequest {
  name: string;
  description?: string;
  statements: ICreatePolicyStatementRequest[];
}

/**
 * Create policy statement request.
 */
export interface ICreatePolicyStatementRequest {
  effect: 'allow' | 'deny';
  submission_feature_urn: string;
  conditions?: ICreatePolicyConditionRequest[];
}

/**
 * Create policy condition request.
 */
export interface ICreatePolicyConditionRequest {
  operator: string;
  key: string;
  value: unknown;
}

/**
 * Update policy request payload.
 */
export interface IUpdatePolicyRequest {
  name: string;
  description?: string;
  statements: ICreatePolicyStatementRequest[];
}
