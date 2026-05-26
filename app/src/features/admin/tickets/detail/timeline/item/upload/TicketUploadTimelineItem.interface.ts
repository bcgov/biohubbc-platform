import {
  SubmissionUploadReviewScope,
  SubmissionUploadReviewTaskStatus,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';

export interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
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
}

export interface ITicketUploadDecisionRowProps {
  upload: TicketSubmissionUploadResponse;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
  onResetDecision: (upload: TicketSubmissionUploadResponse) => void;
}
