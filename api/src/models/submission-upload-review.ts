import { z } from 'zod';

export enum SubmissionUploadReviewScope {
  VALIDATION = 'validation',
  SECURITY = 'security'
}

export enum SubmissionUploadReviewStatus {
  PENDING = 'pending',
  REQUESTED = 'requested',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

const SubmissionUploadReviewScopeSchema = z.nativeEnum(SubmissionUploadReviewScope);
const SubmissionUploadReviewStatusSchema = z.nativeEnum(SubmissionUploadReviewStatus);

export const SubmissionUploadReview = z.object({
  submission_upload_review_id: z.string().uuid(),
  submission_upload_id: z.string().uuid(),
  scope: SubmissionUploadReviewScopeSchema,
  status: SubmissionUploadReviewStatusSchema,
  requested_by: z.number().int().positive().nullable()
});
export type SubmissionUploadReview = z.infer<typeof SubmissionUploadReview>;

export const CreateSubmissionUploadReview = z.object({
  submission_upload_id: z.string().uuid(),
  scope: SubmissionUploadReviewScopeSchema,
  requested_by: z.number().int().positive().nullable()
});
export type CreateSubmissionUploadReview = z.infer<typeof CreateSubmissionUploadReview>;

export const UpdateSubmissionUploadReview = z.object({
  status: SubmissionUploadReviewStatusSchema
});
export type UpdateSubmissionUploadReview = z.infer<typeof UpdateSubmissionUploadReview>;
