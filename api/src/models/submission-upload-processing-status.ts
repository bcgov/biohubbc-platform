import { z } from 'zod';
import { SubmissionUploadJobStatus } from './submission-upload';

/**
 * A processing status row in `submission_upload_status`.
 *
 * Processing rows share the table with review decision rows and are told apart by status value.
 * A row is active while `record_end_date` is null; reprocessing from the same or an earlier stage
 * end-dates the superseded rows rather than deleting them.
 */
export const SubmissionUploadProcessingStatus = z.object({
  submission_upload_status_id: z.number(),
  submission_upload_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number()
});
export type SubmissionUploadProcessingStatus = z.infer<typeof SubmissionUploadProcessingStatus>;
