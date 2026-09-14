import {
  ICreateSubmissionUploadReviewRequest,
  SubmissionUploadReviewScope,
  TicketSubmissionUploadResponse,
  TicketSubmissionUploadReviewResponse
} from 'interfaces/useTicketsApi.interface';

export interface ITicketUploadTimelineItemProps {
  upload: TicketSubmissionUploadResponse;
  dateLabel: string;
  onCreateReview: (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    review: Pick<ICreateSubmissionUploadReviewRequest, 'name' | 'description'>
  ) => void;
  onOpenReview: (
    upload: TicketSubmissionUploadResponse,
    scope: SubmissionUploadReviewScope,
    submissionUploadReviewId: string
  ) => void;
  onAccept: (upload: TicketSubmissionUploadResponse) => void;
  onReject: (upload: TicketSubmissionUploadResponse) => void;
  onResetDecision: (upload: TicketSubmissionUploadResponse) => void;
}

export interface ITicketUploadReviewRowProps {
  label: string;
  scope: SubmissionUploadReviewScope;
  reviews: TicketSubmissionUploadReviewResponse[];
  onCreateReview: (scope: SubmissionUploadReviewScope) => void;
  onOpenReview: (scope: SubmissionUploadReviewScope, submissionUploadReviewId: string) => void;
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
