import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketExtended, TicketStatus, TicketSubmissionUploadResponse } from 'interfaces/useTicketsApi.interface';

export interface ITicketTimelineProps {
  ticket: ITicketExtended;
  isLoading: boolean;
}

export interface TimelineEventBase {
  kind: 'status' | 'comment' | 'data_request' | 'upload';
  id: string;
  create_date: string;
}

export interface StatusEvent extends TimelineEventBase {
  kind: 'status';
  user_identifier: string;
  status: TicketStatus;
}

export interface CommentEvent extends TimelineEventBase {
  kind: 'comment';
  user_identifier: string;
  comment: string;
}

export interface DataRequestEvent extends TimelineEventBase {
  kind: 'data_request';
  data_request: DataRequestResponse;
}

export interface UploadEvent extends TimelineEventBase {
  kind: 'upload';
  upload: TicketSubmissionUploadResponse;
}

export type TimelineEvent = StatusEvent | CommentEvent | DataRequestEvent | UploadEvent;
