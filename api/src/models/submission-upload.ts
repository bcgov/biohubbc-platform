import { z } from 'zod';
import { UploadArtifactRoleEnum } from './upload-artifact';

export const SubmissionUploadJobStatus = z.enum(['pending', 'in_progress', 'succeeded', 'invalid', 'failed']);
export type SubmissionUploadJobStatus = z.infer<typeof SubmissionUploadJobStatus>;

/**
 * SubmissionUpload table schema
 */
export const SubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_id: z.number(),
  upload_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  ticket_id: z.string().uuid(),
  record_end_date: z.coerce.date().nullable().optional()
});
export type SubmissionUpload = z.infer<typeof SubmissionUpload>;

/**
 * Payload for creating a new SubmissionUpload
 */
export const CreateSubmissionUpload = z.object({
  submission_id: z.number(),
  upload_id: z.string().uuid(),
  ticket_id: z.string().uuid()
});
export type CreateSubmissionUpload = z.infer<typeof CreateSubmissionUpload>;

/**
 * Payload for updating an existing SubmissionUpload
 */
export const UpdateSubmissionUpload = z.object({
  submission_id: z.number().optional(),
  upload_id: z.string().uuid().optional(),
  status: SubmissionUploadJobStatus.optional(),
  ticket_id: z.string().uuid().optional()
});
export type UpdateSubmissionUpload = z.infer<typeof UpdateSubmissionUpload>;

export interface SubmissionUploadFilters {
  role?: UploadArtifactRoleEnum;
}
