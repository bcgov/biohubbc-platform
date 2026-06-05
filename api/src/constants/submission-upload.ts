import { SubmissionUpload } from '../models/submission-upload';

/**
 * Upload statuses that represent a completed lifecycle with no further automatic pipeline steps.
 *
 * Used by queue guards (for example in `process-submission-features-job`) to
 * short-circuit work once the upload has reached a final non-retryable state.
 * `failed` is intentionally excluded so users can restart jobs that failed for
 * transient external reasons.
 *
 * Note: `indexed` is NOT terminal — after indexing the automatic security screening
 * job runs; `security_screened` is the new terminal-success state.
 */
export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['security_screened', 'invalid'];

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
 * Used by index-stage initialization guards to allow first-run (`ingested`)
 * and idempotent resume (`indexing`) while rejecting terminal states.
 */
export const INDEX_START_STATUSES: SubmissionUpload['status'][] = ['ingested', 'indexing'];

/**
 * Upload statuses from which automatic security screening is allowed to start or resume.
 *
 * `indexed`            — first run after closure has been populated.
 * `security_screening` — idempotent resume if the job retried mid-flight.
 * `failed`             — explicit restart after exhausted retries.
 */
export const SCREENING_START_STATUSES: SubmissionUpload['status'][] = ['indexed', 'security_screening', 'failed'];
