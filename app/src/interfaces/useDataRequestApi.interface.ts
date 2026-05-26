import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';

export interface CreateTicketDataRequestPayload {
  requested_by: number;
  reason: string;
  system_user_ids: number[];
}

export interface CreateDataRequestPayload {
  reason: string;
  system_user_ids: number[];
  featureTypes: string[];
  expression: ExpressionTreeExpression | null;
}

export interface DataRequestResponse {
  data_request_id: string;
  reason: string;
  team_id: string;
  requested_by: number;
  ticket_id: string;
  policy_id: string;
  status: PolicyStatus;
  create_date: string;
}
