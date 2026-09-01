import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';
import { DataRequestResponse } from './useDataRequestApi.interface';

export type TicketStatus = 'open' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketSystemUserStatus = 'requested' | 'started' | 'blocked' | 'resolved';
export type SubmissionUploadJobStatus =
  | 'uploaded'
  | 'ingesting'
  | 'ingested'
  | 'reconciling'
  | 'reconciled'
  | 'indexing'
  | 'indexed'
  | 'invalid'
  | 'failed';
export type SubmissionValidationStatus = 'pending' | 'started' | 'completed' | 'invalid' | 'failed';
export type SubmissionUploadReviewStatus = 'submitted' | 'approved' | 'denied' | 'deleted';
export type SubmissionUploadReviewScope = 'validation' | 'security';
export type SubmissionUploadReviewTaskStatus =
  | 'pending'
  | 'requested'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'cancelled';

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
  artifacts: ITicketArtifact[];
}

export interface ITicketArtifact {
  ticket_artifact_id: string;
  ticket_id: string;
  artifact_id: string;
  record_end_date: string | null;
  create_date: string;
  object_key: string;
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

export interface TicketSubmissionUploadReviewResponse {
  submission_upload_review_id: string;
  submission_upload_id: string;
  scope: SubmissionUploadReviewScope;
  status: SubmissionUploadReviewTaskStatus;
  requested_by: number | null;
}

export type TicketSubmissionUploadReviews = Record<
  SubmissionUploadReviewScope,
  TicketSubmissionUploadReviewResponse | null
>;

export interface TicketSubmissionUploadResponse {
  submission_upload_id: string;
  submission_uuid: string;
  upload_id: string;
  create_date: string;
  submission_name: string | null;
  submission_description: string | null;
  submission_comment: string | null;
  submitted_by_identifier: string | null;
  upload_status: SubmissionUploadJobStatus;
  review_status: SubmissionUploadReviewStatus;
  validation: {
    submission_validation_id: number;
    job_id: string;
    status: SubmissionValidationStatus;
    metadata: Record<string, unknown> | null;
    started_at: string | null;
    ended_at: string | null;
    create_date: string;
  } | null;
  reviews: TicketSubmissionUploadReviews;
}

export interface ITicketExtended extends ITicket {
  statuses: ITicketStatusLog[];
  comments: ITicketCommentLog[];
  references: ITicketReference[];
  data_requests: DataRequestResponse[];
  submission_uploads: TicketSubmissionUploadResponse[];
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

export interface IUpdateTicketCommentRequest {
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

export interface IUpdateSubmissionUploadReviewStatusRequest {
  status: 'submitted' | 'approved' | 'denied';
}

export interface ISubmissionUploadReviewStatusResponse {
  submission_upload_status_id: number;
  submission_upload_id: string;
  status: SubmissionUploadReviewStatus;
}

export interface IUpdateSubmissionUploadReviewRequest {
  status: SubmissionUploadReviewTaskStatus;
}

export interface ICreateSubmissionUploadReviewRequest {
  scope: SubmissionUploadReviewScope;
  status: SubmissionUploadReviewTaskStatus;
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

export interface IGetTicketArtifactsResponse {
  artifacts: ITicketArtifact[];
  pagination: ApiPaginationResponseParams;
}

export interface IGetTicketArtifactsQueryParams extends Partial<ApiPaginationRequestOptions> {
  search?: string;
}

export interface ITicketsQueryParams extends Partial<ApiPaginationRequestOptions> {
  status?: TicketStatus;
  search?: string;
}
