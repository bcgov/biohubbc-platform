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

/**
 * A row of the single-query history lookup: the upload joined to one of its active processing rows.
 *
 * An upload that exists in the submission but has no processing history yields exactly one row
 * whose status columns are null, so callers can tell "no history" from "upload not found" (no rows)
 * without a second query.
 */
export const SubmissionUploadProcessingStatusHistoryRow = z.union([
  z.object({
    submission_upload_id: z.string().uuid(),
    submission_upload_status_id: z.number(),
    status: SubmissionUploadJobStatus,
    create_date: z.string()
  }),
  z.object({
    submission_upload_id: z.string().uuid(),
    submission_upload_status_id: z.null(),
    status: z.null(),
    create_date: z.null()
  })
]);
export type SubmissionUploadProcessingStatusHistoryRow = z.infer<typeof SubmissionUploadProcessingStatusHistoryRow>;
