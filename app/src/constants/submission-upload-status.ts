import {
  mdiBlockHelper,
  mdiCancel,
  mdiCheck,
  mdiCircleMedium,
  mdiClose,
  mdiCloudUploadOutline,
  mdiHelpCircleOutline,
  mdiProgressClock,
  mdiSkipNext
} from '@mdi/js';
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
  reconciling: 'Reconciling',
  reconciled: 'Reconciled',
  promoting: 'Promoting',
  promoted: 'Promoted',
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

export const SUBMISSION_UPLOAD_JOB_STATUS_ICONS: Record<SubmissionUploadJobStatus, string> = {
  uploaded: mdiCloudUploadOutline,
  ingesting: mdiProgressClock,
  ingested: mdiCheck,
  reconciling: mdiProgressClock,
  reconciled: mdiCheck,
  promoting: mdiProgressClock,
  promoted: mdiCheck,
  indexing: mdiProgressClock,
  indexed: mdiCheck,
  invalid: mdiClose,
  failed: mdiClose
};

/** Icon for a history row whose stage the upload has already moved past. */
export const COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON = mdiCheck;

export const COMPLETED_SUBMISSION_UPLOAD_JOB_STATUS_ICON_COLOR = appTheme.palette.success.main;

export const UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_LABEL = 'Unknown status';

export const UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_ICON = mdiHelpCircleOutline;

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

export const SUBMISSION_UPLOAD_REVIEW_STATUS_BUTTON_COLORS: Partial<
  Record<SubmissionUploadReviewStatus, 'success' | 'error'>
> = {
  approved: 'success',
  denied: 'error'
};

export const SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_OPTIONS: {
  value: SubmissionUploadReviewTaskStatus;
  label: string;
  iconPath: string;
}[] = [
  {
    value: 'pending',
    label: 'Pending',
    iconPath: mdiCircleMedium
  },
  {
    value: 'requested',
    label: 'Requested',
    iconPath: mdiCircleMedium
  },
  {
    value: 'in_progress',
    label: 'In progress',
    iconPath: mdiProgressClock
  },
  {
    value: 'completed',
    label: 'Completed',
    iconPath: mdiCheck
  },
  {
    value: 'blocked',
    label: 'Blocked',
    iconPath: mdiBlockHelper
  },
  {
    value: 'skipped',
    label: 'Skipped',
    iconPath: mdiSkipNext
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    iconPath: mdiCancel
  }
];

export const SUBMISSION_UPLOAD_REVIEW_TASK_STATUS_BUTTON_COLORS: Record<
  SubmissionUploadReviewTaskStatus,
  'primary' | 'success' | 'warning' | null
> = {
  pending: null,
  requested: 'primary',
  in_progress: 'warning',
  completed: 'success',
  blocked: null,
  skipped: null,
  cancelled: null
};
