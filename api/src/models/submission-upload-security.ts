import { z } from 'zod';

export const SubmissionUploadSecurityStatus = z.enum(['pending', 'started', 'completed', 'failed']);
export type SubmissionUploadSecurityStatus = z.infer<typeof SubmissionUploadSecurityStatus>;

/**
 * submission_upload_security table schema.
 *
 * One row represents one automatic security screening event for a submission upload.
 */
export const SubmissionUploadSecurityRecord = z.object({
  submission_upload_security_id: z.number(),
  submission_upload_id: z.string().uuid(),
  job_id: z.string().nullable(),
  status: SubmissionUploadSecurityStatus,
  metadata: z.record(z.unknown()).nullable(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable()
});
export type SubmissionUploadSecurityRecord = z.infer<typeof SubmissionUploadSecurityRecord>;

export const SubmissionUploadSecurityId = SubmissionUploadSecurityRecord.pick({ submission_upload_security_id: true });
export type SubmissionUploadSecurityId = z.infer<typeof SubmissionUploadSecurityId>;
