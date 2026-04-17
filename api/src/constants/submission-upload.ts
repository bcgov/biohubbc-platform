import { SubmissionUpload } from '../models/submission-upload';

export const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];

export const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];
