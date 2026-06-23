import { ApiPaginationResponseParams } from 'types/pagination';
import { ExpressionTreeExpression } from './expression.interface';

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

export interface IPolicy extends IPolicySummary {
  statements: IPolicyStatement[];
}

export interface IPolicyStatement {
  policy_statement_id: string;
  policy_id: string;
  effect: 'allow' | 'deny';
  submission_feature_urn: string;
  policy_expression_id: string | null;
  expression?: ExpressionTreeExpression;
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
  policy_expression_id?: string | null;
  expression?: ExpressionTreeExpression;
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
