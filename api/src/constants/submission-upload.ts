import { SubmissionUpload } from '../models/submission-upload';

/**
 * Processing lifecycle stages in execution order.
 *
 * Reprocessing from a stage supersedes the history rows of that stage and every later one, so the
 * order here decides which `submission_upload_status` rows a transition end-dates.
 */
export const SUBMISSION_UPLOAD_PROCESSING_STAGES: SubmissionUpload['status'][] = [
  'uploaded',
  'ingesting',
  'ingested',
  'reconciling',
  'reconciled',
  'promoting',
  'promoted',
  'indexing',
  'indexed'
];

/**
 * Terminal failure outcomes of a processing attempt. Both are superseded when processing restarts.
 */
export const SUBMISSION_UPLOAD_FAILURE_STATUSES: SubmissionUpload['status'][] = ['invalid', 'failed'];

/**
 * Upload statuses that represent a terminal ingestion lifecycle.
 *
 * Used by queue guards (for example in `process-submission-features-job`) to
 * short-circuit work once the upload has reached a final non-retryable state.
 */
export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];

/**
 * Processing stages during which an attempt can still end in `invalid` or `failed`: every stage
 * before the terminal `indexed`.
 */
export const ACTIVE_UPLOAD_PROCESSING_STAGES: SubmissionUpload['status'][] = SUBMISSION_UPLOAD_PROCESSING_STAGES.filter(
  (status) => !TERMINAL_UPLOAD_STATUSES.includes(status)
);

/**
 * Upload statuses from which processing is allowed to start or resume.
 *
 * Used by process-stage initialization guards to allow first-run (`uploaded`)
 * and idempotent automatic retry (`ingesting`) while rejecting failures from this
 * or any later lifecycle stage.
 */
export const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];

/**
 * Upload statuses from which indexing is allowed to start or resume.
 *
 * Used by index-stage initialization guards to allow first-run (`reconciled`)
 * and idempotent resume (`indexing`) while rejecting terminal states.
 */
export const INDEX_START_STATUSES: SubmissionUpload['status'][] = ['reconciled', 'indexing'];

/** Upload statuses from which reconciliation may start or resume. */
export const RECONCILE_START_STATUSES: SubmissionUpload['status'][] = ['ingested', 'reconciling'];
