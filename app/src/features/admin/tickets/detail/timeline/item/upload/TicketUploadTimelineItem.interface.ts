import {
  ICreateSubmissionUploadReviewRequest,
  ISubmissionUploadProcessingStatusHistoryItem,
  SubmissionUploadReviewScope,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';

/** Where an upload's processing status history stands; undefined until it has been requested. */
export type SubmissionUploadStatusHistoryState =
  | { status: 'loading' }
  | { status: 'loaded'; history: ISubmissionUploadProcessingStatusHistoryItem[] }
  | { status: 'error'; message: string };

export interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
  /** Whether the viewer may expand the status row to load the processing history (admin-only endpoint). */
  canViewStatusHistory: boolean;
  onCreateReview: (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    review: Pick<ICreateSubmissionUploadReviewRequest, 'name' | 'description'>
  ) => void;
  onOpenReview: (upload: TicketSubmissionUploadResponse, submissionUploadReviewId: string) => void;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
  onResetDecision: (upload: TicketSubmissionUploadResponse) => void;
}

export interface ITicketUploadReviewRowProps {
  label: string;
  scope: SubmissionUploadReviewScope;
  reviews: TicketSubmissionUploadReviewResponse[];
  onCreateReview: (scope: SubmissionUploadReviewScope) => void;
  onOpenReview: (submissionUploadReviewId: string) => void;
}

export interface ITicketUploadStatusRowProps {
  upload: TicketSubmissionUploadResponse;
  /** Whether the row is expandable; false renders the current status only, with no toggle or request. */
  canViewStatusHistory: boolean;
}

export interface ITicketUploadStatusHistoryProps {
  statusHistory: SubmissionUploadStatusHistoryState | undefined;
}

export interface ITicketUploadDecisionRowProps {
  upload: TicketSubmissionUploadResponse;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
  onResetDecision: (upload: TicketSubmissionUploadResponse) => void;
}
