import { z } from 'zod';
import { UploadArtifactRoleEnum } from './upload-artifact';

/**
 * SubmissionUpload table schema
 */
export const SubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_id: z.number(),
  upload_id: z.string().uuid()
});
export type SubmissionUpload = z.infer<typeof SubmissionUpload>;

/**
 * Payload for creating a new SubmissionUpload
 */
export const CreateSubmissionUpload = z.object({
  submission_id: z.number(),
  upload_id: z.string().uuid()
});
export type CreateSubmissionUpload = z.infer<typeof CreateSubmissionUpload>;

/**
 * Payload for updating an existing SubmissionUpload
 */
export const UpdateSubmissionUpload = z.object({
  submission_id: z.number().optional(),
  upload_id: z.string().uuid().optional()
});
export type UpdateSubmissionUpload = z.infer<typeof UpdateSubmissionUpload>;

export interface SubmissionUploadFilters {
  role?: UploadArtifactRoleEnum;
}

/**
 * Job payload for the ingestion pipeline. Single identifier eliminates the risk
 * of submissionId/uploadId getting out of sync — each consumer resolves what
 * it needs from the submission_upload bridge table.
 */
export interface IngestionJobData {
  /** The submission_upload_id that triggered this ingestion job */
  submissionUploadId: string;
}
