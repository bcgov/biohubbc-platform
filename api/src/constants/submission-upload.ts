import { SubmissionUploadJobStatus } from '../models/submission-upload';

export const TERMINAL_UPLOAD_STATUSES: ReadonlySet<SubmissionUploadJobStatus> = new Set([
  'indexed',
  'invalid',
  'failed'
]);
