import { ApiPaginationResponseParams } from 'types/pagination';
import { ExpressionTreeExpression } from './expression.interface';
import { ITeamPolicyDetails } from './useTeamPoliciesApi.interface';

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
  expressions: IPolicyExpression[];
}

export interface IPolicyStatement {
  policy_statement_id: string;
  policy_id: string;
  effect: 'allow' | 'deny';
  submission_feature_urn: string;
  policy_expression_id: string | null;
  expression?: ExpressionTreeExpression;
}

export interface IPolicyExpression {
  policy_expression_id: string;
  policy_id: string;
  expression_id: string;
  name: string | null;
  description: string | null;
  expression: ExpressionTreeExpression;
}

/**
 * Paginated policies response.
 */
export interface IPoliciesResponse {
  policies: IPolicy[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Paginated policy expressions response.
 */
export interface IPolicyExpressionsResponse {
  expressions: IPolicyExpression[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Paginated policy teams response.
 */
export interface IPolicyTeamsResponse {
  teams: ITeamPolicyDetails[];
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
 * Create policy expression request.
 */
export interface ICreatePolicyExpressionRequest {
  name: string;
  description?: string | null;
  expression: ExpressionTreeExpression;
}

/**
 * Update policy expression request.
 */
export type IUpdatePolicyExpressionRequest = ICreatePolicyExpressionRequest;

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
