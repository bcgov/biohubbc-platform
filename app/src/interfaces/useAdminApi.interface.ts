export interface IgcNotifyGenericMessage {
  subject: string;
  header: string;
  body1: string;
  body2: string;
  footer: string;
}

export interface IgcNotifyRecipient {
  emailAddress: string;
  phoneNumber: string;
  userId: number;
}

export interface IGetRoles {
  system_role_id: number;
  name: string;
}

export interface ISubmissionUploadReviewDetail {
  submission_upload_review_id: string;
  submission_upload_id: string;
  name: string;
  description: string | null;
  scope: 'validation' | 'security';
  status: 'pending' | 'requested' | 'in_progress' | 'completed' | 'blocked' | 'skipped' | 'cancelled';
  requested_by: number | null;
}

export interface ISubmissionUploadReconciliationCounts {
  new: number;
  modified: number;
  unmodified: number;
}
