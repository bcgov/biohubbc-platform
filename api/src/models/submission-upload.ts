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
  'security_screening',
  'security_screened',
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
  blueprint_id: z.number(),
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
  blueprint_id: z.number(),
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
  ticket_id: z.string().uuid().optional()
});
export type UpdateSubmissionUpload = z.infer<typeof UpdateSubmissionUpload>;

export interface SubmissionUploadFilters {
  role?: UploadArtifactRoleEnum;
}

export const TicketSubmissionUploadReviews = z.object({
  validation: SubmissionUploadReview.nullable(),
  security: SubmissionUploadReview.nullable()
});
export type TicketSubmissionUploadReviews = z.infer<typeof TicketSubmissionUploadReviews>;

export const TicketSubmissionUpload = z.object({
  submission_upload_id: z.string().uuid(),
  submission_uuid: z.string().uuid(),
  upload_id: z.string().uuid(),
  create_date: z.string(),
  submission_name: z.string().nullable(),
  submission_description: z.string().nullable(),
  submission_comment: z.string().nullable(),
  submitted_by_identifier: z.string().nullable(),
  upload_status: SubmissionUploadJobStatus,
  review_status: SubmissionUploadStatusTypeEnum,
  validation: TicketSubmissionValidation.nullable(),
  reviews: TicketSubmissionUploadReviews
});
export type TicketSubmissionUpload = z.infer<typeof TicketSubmissionUpload>;
