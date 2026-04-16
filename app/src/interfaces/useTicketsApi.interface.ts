import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';
import { DataRequestResponse } from './useDataRequestApi.interface';

export type TicketStatus = 'open' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ITicket {
  ticket_id: string;
  ticket_slug: string;
  subject: string;
  description: string | null;
  team_id: string;
  create_date: string;
  priority: TicketPriority;
  status: TicketStatus;
}

export interface ITicketStatusHistory {
  ticket_status_history_id?: string | null;
  ticket_comment_id?: string | null;
  data_request_id?: string | null;
  ticket_id: string;
  user_identifier: string;
  create_date: string;
  status?: TicketStatus | null;
  comment?: string | null;
  reason?: string | null;
}

export interface ITicketStatusLog {
  ticket_status_history_id: string;
  ticket_id: string;
  user_identifier: string;
  create_date: string;
  status: TicketStatus;
}

export interface ITicketCommentLog {
  ticket_comment_id: string;
  ticket_id: string;
  user_identifier: string;
  create_date: string;
  comment: string;
}

export type TicketRelationshipType =
  | 'blocks'
  | 'blocked_by'
  | 'duplicates'
  | 'duplicate_of'
  | 'relates_to'
  | 'resolves'
  | 'resolved_by';

export interface ITicketReference {
  ticket_reference_id: string;
  source_ticket_id: string;
  source_ticket_slug: string;
  source_ticket_subject: string;
  target_ticket_id: string;
  target_ticket_slug: string;
  target_ticket_subject: string;
  relationship: TicketRelationshipType;
  user_identifier: string;
  create_date: string;
}

export interface ITicketWithHistory extends ITicket {
  statuses: ITicketStatusLog[];
  comments: ITicketCommentLog[];
  references: ITicketReference[];
  data_requests: DataRequestResponse[];
}

export interface ICreateTicketRequest {
  subject: string;
  description: string | null;
  priority: TicketPriority;
}

export interface IUpdateTicketRequest {
  subject?: string;
  description?: string | null;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface ICreateTicketCommentRequest {
  comment: string;
}

export interface ICreateTicketReference {
  target_ticket_id: string;
  relationship: TicketRelationshipType;
}

export interface ICreateTicketReferenceRequest {
  references: ICreateTicketReference[];
}

export interface IGetTicketsResponse {
  tickets: ITicket[];
  pagination: ApiPaginationResponseParams;
}

export interface IGetTicketsParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
  search?: string;
}

export interface IGetUserTicketsParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
  search?: string;
}
