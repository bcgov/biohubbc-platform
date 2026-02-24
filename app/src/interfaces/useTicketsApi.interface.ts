import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export type TicketStatus = 'OPEN' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ITicket {
  ticket_id: string;
  ticket_slug: string;
  title: string;
  description: string | null;
  team_id: string;
  priority: TicketPriority;
  status: TicketStatus;
}

export interface ITicketStatusHistory {
  ticket_status_history_id: string;
  ticket_id: string;
  status: TicketStatus;
}

export interface ITicketWithHistory extends ITicket {
  history: ITicketStatusHistory[];
}

export interface ICreateTicketRequest {
  title: string;
  description?: string | null;
  priority?: TicketPriority;
}

export interface IUpdateTicketRequest {
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface IGetTicketsResponse {
  tickets: ITicket[];
  pagination: ApiPaginationResponseParams;
}

export interface IGetTicketsParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
}
