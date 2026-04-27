import { SubmissionUpload } from '../models/submission-upload';

/**
 * Upload statuses that represent a completed ingestion lifecycle.
 *
 * Used by queue guards (for example in `process-submission-features-job`) to
 * short-circuit work once the upload has reached a final state. `failed` is
 * applied only after queue retries are exhausted.
 */
export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];

/**
 * Upload statuses from which processing is allowed to start or resume.
 *
 * Used by process-stage initialization guards to allow first-run (`uploaded`)
 * and idempotent resume (`ingesting`) while rejecting terminal states.
 */
export const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];

/**
 * Upload statuses from which indexing is allowed to start or resume.
 *
 * Used by index-stage initialization guards to allow first-run (`ingested`)
 * and idempotent resume (`indexing`) while rejecting terminal states.
 */
export const INDEX_START_STATUSES: SubmissionUpload['status'][] = ['ingested', 'indexing'];
