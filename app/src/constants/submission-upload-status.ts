import { mdiCheck, mdiClose } from '@mdi/js';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from 'interfaces/useTicketsApi.interface';
import appTheme from 'themes/appTheme';

export const SUBMISSION_UPLOAD_JOB_STATUS_LABELS: Record<SubmissionUploadJobStatus, string> = {
  uploaded: 'Uploaded',
  ingesting: 'Ingesting',
  ingested: 'Ingested',
  reconciled: 'Reconciled',
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

export const SUBMISSION_UPLOAD_DECISION_LABELS: Record<SubmissionUploadDecision, string> = {
  pending: 'Pending',
  approved: 'Accepted',
  denied: 'Rejected'
};

export const SUBMISSION_UPLOAD_DECISION_BUTTON_COLORS: Partial<Record<SubmissionUploadDecision, 'success' | 'error'>> =
  {
    approved: 'success',
    denied: 'error'
  };
