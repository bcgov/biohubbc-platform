import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketTagEvent } from 'interfaces/useTagsApi.interface';
import {
  ITicketArtifact,
  ITicketExtended,
  TicketStatus,
  TicketSubmissionUploadResponse
} from 'interfaces/useTicketsApi.interface';

export interface ITicketTimelineProps {
  ticket: ITicketExtended;
  /**
   * Tags added to and removed from the ticket. Tag history is administrative only: the admin ticket page passes it,
   * and the portal passes nothing.
   */
  tagEvents?: ITicketTagEvent[];
}

export interface TimelineEventBase {
  kind: 'status' | 'comment' | 'data_request' | 'upload' | 'tag';
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
  artifacts: ITicketArtifact[];
}

export interface DataRequestEvent extends TimelineEventBase {
  kind: 'data_request';
  data_request: DataRequestResponse;
}

export interface UploadEvent extends TimelineEventBase {
  kind: 'upload';
  upload: TicketSubmissionUploadResponse;
}

export interface TagEvent extends TimelineEventBase {
  kind: 'tag';
  tag_event: ITicketTagEvent;
}

export type TimelineEvent = StatusEvent | CommentEvent | DataRequestEvent | UploadEvent | TagEvent;
