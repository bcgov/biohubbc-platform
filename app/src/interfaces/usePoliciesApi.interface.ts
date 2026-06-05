import { ApiPaginationResponseParams } from 'types/pagination';

export enum PolicyStatus {
  REQUESTED = 'requested',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  DENIED = 'denied'
}

/**
 * Policy response shape without statements.
 */
export interface IPolicySummary {
  policy_id: string;
  name: string;
  description: string | null;
  status: PolicyStatus;
}

/**
 * Policy with statements and conditions (API response).
 */
export interface IPolicy extends IPolicySummary {
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
  pagination: ApiPaginationResponseParams;
}

/**
 * Create policy request payload.
 */
export interface ICreatePolicyRequest {
  name: string;
  description?: string;
  status?: PolicyStatus;
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
  status?: PolicyStatus;
  statements: ICreatePolicyStatementRequest[];
}

/**
 * Update policy status request payload.
 */
export interface IUpdatePolicyStatusRequest {
  status: PolicyStatus;
}
