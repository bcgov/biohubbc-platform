import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export type TicketStatus = 'open' | 'closed';
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface ITicket {
  ticket_id: string;
  ticket_slug: string;
  title: string;
  description: string | null;
  team_id: string;
  create_date: string;
  priority: TicketPriority;
  status: TicketStatus;
}

export interface ITicketStatusHistory {
  ticket_status_history_id?: string | null;
  ticket_comment_id?: string | null;
  ticket_id: string;
  user_identifier: string;
  create_date: string;
  status?: TicketStatus | null;
  comment?: string | null;
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

export interface ITicketWithHistory extends ITicket {
  status_log: ITicketStatusLog[];
  comment_log: ITicketCommentLog[];
}

export interface ICreateTicketRequest {
  title: string;
  description: string | null;
  priority: TicketPriority;
}

export interface IUpdateTicketRequest {
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface ICreateTicketCommentRequest {
  comment: string;
}

export interface IGetTicketsResponse {
  tickets: ITicket[];
  pagination: ApiPaginationResponseParams;
}

export interface IGetTicketsParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
}
