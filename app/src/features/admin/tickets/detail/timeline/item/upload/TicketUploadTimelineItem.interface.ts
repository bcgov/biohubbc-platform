import {
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';
import { SubmissionUploadStatusHistoryState } from '../../hooks/upload/useSubmissionUploadStatusHistory';

export interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
  statusHistory: SubmissionUploadStatusHistoryState | undefined;
  onLoadStatusHistory: (upload: TicketSubmissionUploadResponse) => void;
  onRequestReview: (upload: TicketSubmissionUploadResponse, scope: SubmissionUploadReviewScope) => void;
  onUpdateReview: (
    upload: TicketSubmissionUploadResponse,
    review: TicketSubmissionUploadReviewResponse,
    status: SubmissionUploadReviewTaskStatus
  ) => void;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
  onResetDecision: (upload: TicketSubmissionUploadResponse) => void;
}

export interface ITicketUploadReviewRowProps {
  label: string;
  upload: TicketSubmissionUploadResponse;
  review: TicketSubmissionUploadReviewResponse;
  onUpdateReview: (
    upload: TicketSubmissionUploadResponse,
    review: TicketSubmissionUploadReviewResponse,
    status: SubmissionUploadReviewTaskStatus
  ) => void;
}

export interface ITicketUploadReviewRequestRowProps {
  label: string;
  scope: SubmissionUploadReviewScope;
  upload: TicketSubmissionUploadResponse;
  onRequestReview: (upload: TicketSubmissionUploadResponse, scope: SubmissionUploadReviewScope) => void;
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
