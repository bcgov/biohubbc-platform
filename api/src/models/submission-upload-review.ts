import { z } from 'zod';

export enum SubmissionUploadReviewScope {
  VALIDATION = 'validation',
  SECURITY = 'security'
}

export enum SubmissionUploadReviewStatus {
  REQUESTED = 'requested',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

export const SubmissionUploadReviewScopeSchema = z.nativeEnum(SubmissionUploadReviewScope);
export const SubmissionUploadReviewStatusSchema = z.nativeEnum(SubmissionUploadReviewStatus);

export interface SubmissionUploadReviewFilters {
  scope?: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}

export const SubmissionUploadReview = z.object({
  submission_upload_review_id: z.number().int().positive(),
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

export const SubmissionUploadReviewUpdate = z.object({
  status: SubmissionUploadReviewStatusSchema
});
export type SubmissionUploadReviewUpdate = z.infer<typeof SubmissionUploadReviewUpdate>;
