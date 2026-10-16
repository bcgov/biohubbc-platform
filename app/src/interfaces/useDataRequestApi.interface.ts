import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

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

/** One data request as the administrative list shows it: its decision is the status of its policy. */
export interface DataRequestListItem {
  data_request_id: string;
  reason: string;
  status: PolicyStatus;
  create_date: string;
  requested_by: number;
  requested_by_name: string | null;
  ticket_id: string;
  policy_id: string;
}

/** Paginated data requests response. */
export interface DataRequestListResponse {
  data_requests: DataRequestListItem[];
  pagination: ApiPaginationResponseParams;
}

/** One feature type a data request asks for, with the expression that limits it, or null when it asks for all. */
export interface DataRequestFeatureType {
  feature_type_name: string;
  expression: ExpressionTreeExpression | null;
}

/** The unique feature types a data request asks for. */
export interface DataRequestFeatureTypesResponse {
  feature_types: DataRequestFeatureType[];
}

/** One recipient of a data request: a member of the team its policy is assigned to. */
export interface DataRequestRecipient {
  system_user_id: number;
  user_identifier: string;
  display_name: string | null;
  email: string | null;
}

/** The users who receive access when a data request is approved. */
export interface DataRequestRecipientsResponse {
  recipients: DataRequestRecipient[];
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
