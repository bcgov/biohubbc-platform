import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';
import { DataRequestResponse } from './useDataRequestApi.interface';

export type TicketStatus = 'open' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketSystemUserStatus = 'requested' | 'started' | 'blocked' | 'resolved';

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

export interface ITicketStatusLog {
  ticket_status_id: string;
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

export interface ITicketArtifact {
  ticket_artifact_id: string;
  ticket_id: string;
  artifact_id: string;
  record_end_date: string | null;
  create_date: string;
  key: string;
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

export interface ITicketSystemUser {
  ticket_system_user_id: string;
  ticket_id: string;
  system_user_id: number;
  status: TicketSystemUserStatus;
  system_user: {
    system_user_id: number;
    display_name: string | null;
    user_identifier: string;
    email: string | null;
  };
}

export interface ITicketExtended extends ITicket {
  statuses: ITicketStatusLog[];
  comments: ITicketCommentLog[];
  artifacts: ITicketArtifact[];
  references: ITicketReference[];
  data_requests: DataRequestResponse[];
  ticket_system_users: ITicketSystemUser[];
}

export interface ICreateTicketRequest {
  subject: string;
  description: string | null;
  priority: TicketPriority;
  systemUserIds?: number[];
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

export interface ICreateTicketUploadRequest {
  file_name: string;
  byte_size: number;
  content_type?: string;
}

export interface ICreateTicketUploadResponse {
  upload_id: string;
  presigned_upload_url: string;
}

export interface ICompleteTicketUploadRequest {
  status: 'uploaded';
}

export interface ITicketArtifactDownloadResponse {
  signed_url: string;
}

export interface ICreateTicketReference {
  target_ticket_id: string;
  relationship: TicketRelationshipType;
}

export interface ICreateTicketReferenceRequest {
  references: ICreateTicketReference[];
}

export interface ICreateTicketSystemUser {
  system_user_id: number;
  status: TicketSystemUserStatus;
}

export interface IUpdateTicketSystemUserStatusRequest {
  status: TicketSystemUserStatus;
}

export interface IGetTicketsResponse {
  tickets: ITicket[];
  pagination: ApiPaginationResponseParams;
}

export interface ITicketsQueryParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
  search?: string;
}
