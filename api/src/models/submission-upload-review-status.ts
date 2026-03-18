import { z } from 'zod';

export const SubmissionUploadStatusTypeEnum = z.enum(['submitted', 'approved', 'denied', 'deleted']);
export type SubmissionUploadStatusTypeEnum = z.infer<typeof SubmissionUploadStatusTypeEnum>;

/**
 * SubmissionUploadReviewStatus table schema
 */
export const SubmissionUploadReviewStatus = z.object({
  submission_upload_status_id: z.number(),
  submission_upload_id: z.string().uuid(),
  status: SubmissionUploadStatusTypeEnum
});
export type SubmissionUploadReviewStatus = z.infer<typeof SubmissionUploadReviewStatus>;

/**
 * Payload for creating a new SubmissionUploadReviewStatus
 */
export const CreateSubmissionUploadReviewStatus = z.object({
  submission_upload_id: z.string().uuid(),
  status: SubmissionUploadStatusTypeEnum.default('submitted')
});
export type CreateSubmissionUploadReviewStatus = z.infer<typeof CreateSubmissionUploadReviewStatus>;

/**
 * Payload for updating a SubmissionUploadReviewStatus.
 * Admin PATCH uses only approved/denied; delete handler sets status to 'deleted'.
 */
export const UpdateSubmissionUploadReviewStatus = z.object({
  status: z.enum(['approved', 'denied', 'deleted'])
});
export type UpdateSubmissionUploadReviewStatus = z.infer<typeof UpdateSubmissionUploadReviewStatus>;

/**
 * Row shape for submission_upload_status history (includes create_date and submission_id for ordering/display).
 */
export const SubmissionUploadReviewStatusHistoryRow = z.object({
  submission_id: z.number(),
  submission_upload_id: z.string().uuid(),
  status: SubmissionUploadStatusTypeEnum,
  create_date: z.coerce.date()
});
export type SubmissionUploadReviewStatusHistoryRow = z.infer<typeof SubmissionUploadReviewStatusHistoryRow>;
