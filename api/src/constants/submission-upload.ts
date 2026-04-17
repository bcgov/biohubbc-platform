import { SubmissionUpload } from '../models/submission-upload';

/**
 * Upload statuses that represent a completed ingestion lifecycle.
 *
 * Used by queue guards (for example in `process-submission-features-job`) to
 * short-circuit retries/restarts once the upload has reached a final state.
 */
export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];

/**
 * Upload statuses from which processing is allowed to start or resume.
 *
 * Used by process-stage initialization guards to allow first-run (`uploaded`)
 * and safe retry/resume (`ingesting`) while rejecting all other states.
 */
export const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];
