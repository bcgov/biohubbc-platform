import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketArtifact, ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';

export interface ITicketTimelineProps {
  ticket: ITicketExtended;
  isLoading: boolean;
}

export interface TimelineEventBase {
  kind: 'status' | 'comment' | 'data_request';
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

export type TimelineEvent = StatusEvent | CommentEvent | DataRequestEvent;
