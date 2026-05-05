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

export const SubmissionUploadReview = z.object({
  submission_upload_review_id: z.number().int().positive(),
  submission_upload_id: z.string().uuid(),
  scope: SubmissionUploadReviewScopeSchema,
  status: SubmissionUploadReviewStatusSchema,
  requested_by: z.number().int().positive().nullable(),
  requested_at: z.string(),
  assigned_to: z.number().int().positive().nullable(),
  started_at: z.string().nullable(),
  completed_by: z.number().int().positive().nullable(),
  completed_at: z.string().nullable(),
  note: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  create_date: z.string(),
  create_user: z.number().int(),
  update_date: z.string().nullable(),
  update_user: z.number().int().nullable(),
  revision_count: z.number().int(),
  record_end_date: z.string().nullable()
});
export type SubmissionUploadReview = z.infer<typeof SubmissionUploadReview>;

export const SubmissionUploadReviewCreate = z.object({
  submission_upload_id: z.string().uuid(),
  scope: SubmissionUploadReviewScopeSchema,
  note: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});
export type SubmissionUploadReviewCreate = z.infer<typeof SubmissionUploadReviewCreate>;

export const SubmissionUploadReviewUpdate = z.object({
  status: SubmissionUploadReviewStatusSchema,
  assigned_to: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional()
});
export type SubmissionUploadReviewUpdate = z.infer<typeof SubmissionUploadReviewUpdate>;
