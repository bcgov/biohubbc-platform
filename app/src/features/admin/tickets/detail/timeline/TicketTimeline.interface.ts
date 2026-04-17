import { DataRequestResponse } from 'interfaces/useDataRequestApi.interface';
import { ITicketExtended, TicketStatus } from 'interfaces/useTicketsApi.interface';

export interface ITicketTimelineProps {
  ticket: ITicketExtended | undefined;
  isLoading: boolean;
}

export type IStatusTimelineEvent = {
  kind: 'status';
  id: string;
  create_date: string;
  user_identifier: string;
  status: TicketStatus;
};

export type ICommentTimelineEvent = {
  kind: 'comment';
  id: string;
  create_date: string;
  user_identifier: string;
  comment: string;
};

export type IDataRequestTimelineEvent = {
  kind: 'data_request';
  id: string;
  create_date: string;
  dataRequest: DataRequestResponse;
};

export type ITimelineEvent = IStatusTimelineEvent | ICommentTimelineEvent | IDataRequestTimelineEvent;
