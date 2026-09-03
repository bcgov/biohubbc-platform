import {
  ICreateSubmissionUploadReviewRequest,
  SubmissionUploadReviewScope,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { SubmissionUploadStatusHistoryState } from '../../hooks/upload/useSubmissionUploadStatusHistory';

export interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
  statusHistory: SubmissionUploadStatusHistoryState | undefined;
  onLoadStatusHistory: (upload: TicketSubmissionUploadResponse) => void;
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
  /** Cached history state for this upload; undefined until it has been requested. */
  statusHistory: SubmissionUploadStatusHistoryState | undefined;
  onLoadStatusHistory: (upload: TicketSubmissionUploadResponse) => void;
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
