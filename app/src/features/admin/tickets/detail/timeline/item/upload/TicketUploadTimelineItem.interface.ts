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
  /** Whether the viewer may expand the status row to load the processing history (admin-only endpoint). */
  canViewStatusHistory: boolean;
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
  /** Whether the row is expandable; false renders the current status only, with no toggle or request. */
  canViewStatusHistory: boolean;
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
