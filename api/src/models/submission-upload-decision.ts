import { z } from 'zod';
import { SubmissionUploadDecision } from './submission-upload';

/**
 * Payload for recording a human review decision on a submission upload.
 */
export const UpdateSubmissionUploadDecision = z.object({
  decision: SubmissionUploadDecision
});
export type UpdateSubmissionUploadDecision = z.infer<typeof UpdateSubmissionUploadDecision>;

/**
 * Result of a decision write on `submission_upload`.
 *
 * `revision_count` is bumped by the audit trigger on every update and keys the closure recompute job
 * queued by an approval.
 */
export const SubmissionUploadDecisionRow = z.object({
  submission_upload_id: z.string().uuid(),
  decision: SubmissionUploadDecision,
  revision_count: z.number()
});
export type SubmissionUploadDecisionRow = z.infer<typeof SubmissionUploadDecisionRow>;

/**
 * Decision of a submission upload as returned to API clients.
 */
export const SubmissionUploadDecisionResult = SubmissionUploadDecisionRow.pick({
  submission_upload_id: true,
  decision: true
});
export type SubmissionUploadDecisionResult = z.infer<typeof SubmissionUploadDecisionResult>;

/**
 * One upload of a submission with its decision, for the publish history read.
 *
 * Soft-deleted uploads are included (`record_end_date` set) so the history can report them as deleted.
 */
export const SubmissionUploadDecisionHistoryRow = z.object({
  submission_id: z.number(),
  submission_upload_id: z.string().uuid(),
  decision: SubmissionUploadDecision,
  record_end_date: z.string().nullable(),
  create_date: z.string()
});
export type SubmissionUploadDecisionHistoryRow = z.infer<typeof SubmissionUploadDecisionHistoryRow>;

/**
 * Wire values of the publish history endpoint, kept stable for external consumers.
 */
export const SubmissionUploadHistoryStatus = z.enum(['submitted', 'approved', 'denied', 'deleted']);
export type SubmissionUploadHistoryStatus = z.infer<typeof SubmissionUploadHistoryStatus>;
