import { SubmissionUpload } from '../models/submission-upload';

/**
 * Upload statuses that represent a completed ingestion lifecycle.
 *
 * Used by queue guards (for example in `process-submission-features-job`) to
 * short-circuit work once the upload has reached a final non-retryable state.
 * `failed` is intentionally excluded so users can restart jobs that failed for
 * transient external reasons.
 */
export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid'];

/**
 * Upload statuses from which processing is allowed to start or resume.
 *
 * Used by process-stage initialization guards to allow first-run (`uploaded`)
 * idempotent resume (`ingesting`), and explicit restart after exhausted retries
 * (`failed`) while rejecting non-process lifecycle states.
 */
export const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting', 'failed'];

/**
 * Upload statuses from which indexing is allowed to start or resume.
 *
 * Used by index-stage initialization guards to allow first-run (`reconciled`)
 * and idempotent resume (`indexing`) while rejecting terminal states.
 */
export const INDEX_START_STATUSES: SubmissionUpload['status'][] = ['reconciled', 'indexing'];

/** Upload statuses from which reconciliation may start or resume. */
export const RECONCILE_START_STATUSES: SubmissionUpload['status'][] = ['ingested', 'reconciling'];
