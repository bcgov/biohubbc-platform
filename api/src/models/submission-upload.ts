import { z } from 'zod';
import { SubmissionUploadReview } from './submission-upload-review';
import { SubmissionUploadStatusTypeEnum } from './submission-upload-review-status';
import { TicketSubmissionValidation } from './submission-validation';
import { UploadArtifactRoleEnum } from './upload-artifact';

export const SubmissionUploadJobStatus = z.enum([
  'uploaded',
  'ingesting',
  'ingested',
  'indexing',
  'indexed',
  // Terminal failure states
  'invalid',
  'failed'
]);
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
  comment: z.string().nullable().optional(),
  record_end_date: z.coerce.date().nullable().optional()
});
export type SubmissionUpload = z.infer<typeof SubmissionUpload>;

/**
 * Payload for creating a new SubmissionUpload
 */
export const CreateSubmissionUpload = z.object({
  submission_id: z.number(),
  upload_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  status: SubmissionUploadJobStatus,
  comment: z.string().nullable().optional()
});
export type CreateSubmissionUpload = z.infer<typeof CreateSubmissionUpload>;

/**
 * Payload for updating an existing SubmissionUpload
 */
export const UpdateSubmissionUpload = z.object({
  submission_id: z.number().optional(),
  upload_id: z.string().uuid().optional(),
  status: SubmissionUploadJobStatus.optional(),
  ticket_id: z.string().uuid().optional(),
  comment: z.string().nullable().optional()
});
export type UpdateSubmissionUpload = z.infer<typeof UpdateSubmissionUpload>;

export interface SubmissionUploadFilters {
  role?: UploadArtifactRoleEnum;
}

export const TicketSubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_id: z.number().int().positive(),
  submission_uuid: z.string().uuid(),
  upload_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  create_date: z.string(),
  submission_name: z.string().nullable(),
  submission_description: z.string().nullable(),
  submission_comment: z.string().nullable(),
  submitted_by_identifier: z.string().nullable(),
  upload_status: SubmissionUploadJobStatus,
  review_status: SubmissionUploadStatusTypeEnum,
  validation: TicketSubmissionValidation,
  reviews: z.array(SubmissionUploadReview)
});
export type TicketSubmissionUpload = z.infer<typeof TicketSubmissionUpload>;
