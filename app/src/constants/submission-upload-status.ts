import { mdiBlockHelper, mdiCancel, mdiCheck, mdiCircleMedium, mdiClose, mdiProgressClock, mdiSkipNext } from '@mdi/js';
import {
  SubmissionUploadJobStatus,
  SubmissionUploadReviewStatus,
  SubmissionUploadReviewTaskStatus
} from 'interfaces/useTicketsApi.interface';
import appTheme from 'themes/appTheme';

export const SUBMISSION_UPLOAD_JOB_STATUS_LABELS: Record<SubmissionUploadJobStatus, string> = {
  uploaded: 'Uploaded',
  ingesting: 'Ingesting',
  ingested: 'Ingested',
  indexing: 'Indexing',
  indexed: 'Indexed',
  invalid: 'Invalid',
  failed: 'Failed'
};

export const TERMINAL_SUBMISSION_UPLOAD_JOB_STATUSES: SubmissionUploadJobStatus[] = ['indexed', 'invalid', 'failed'];

export const SUBMISSION_UPLOAD_JOB_STATUS_COLORS: Partial<Record<SubmissionUploadJobStatus, string>> = {
  indexed: 'success.main',
  invalid: 'error.main',
  failed: 'error.main'
};

export const SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_ICONS: Partial<Record<SubmissionUploadJobStatus, string>> = {
  indexed: mdiCheck,
  invalid: mdiClose,
  failed: mdiClose
};

export const SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_ICON_COLORS: Partial<Record<SubmissionUploadJobStatus, string>> = {
  indexed: appTheme.palette.success.main,
  invalid: appTheme.palette.error.main,
  failed: appTheme.palette.error.main
};

export const SUBMISSION_UPLOAD_REVIEW_STATUS_LABELS: Record<SubmissionUploadReviewStatus, string> = {
  submitted: 'Submitted',
  approved: 'Accepted',
  denied: 'Rejected',
  deleted: 'Deleted'
};

export const SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_LABELS: Record<SubmissionUploadReviewTaskStatus, string> = {
  pending: 'Pending',
  requested: 'Ready for review',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
  skipped: 'Skipped',
  cancelled: 'Cancelled'
};

const SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_ICONS: Record<SubmissionUploadReviewTaskStatus, string> = {
  pending: mdiCircleMedium,
  requested: mdiCircleMedium,
  in_progress: mdiProgressClock,
  completed: mdiCheck,
  blocked: mdiBlockHelper,
  skipped: mdiSkipNext,
  cancelled: mdiCancel
};

export const SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS = Object.entries(
  SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_LABELS
).map(([value, label]) => ({
  value,
  label,
  iconPath: SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_ICONS[value as SubmissionUploadReviewTaskStatus]
}));

export const SUBMISSION_UPLOAD_FINAL_DECISION_OPTIONS = [
  {
    value: 'approved',
    label: 'Accept',
    iconPath: mdiCheck
  },
  {
    value: 'denied',
    label: 'Reject',
    iconPath: mdiClose
  }
];

export const SUBMISSION_UPLOAD_REVIEW_ACTION_BUTTON_SX = {
  bgcolor: 'grey.200',
  color: 'text.primary',
  '&:hover': {
    bgcolor: 'grey.300'
  },
  '&.Mui-disabled': {
    bgcolor: 'action.disabledBackground',
    color: 'text.disabled'
  }
};
