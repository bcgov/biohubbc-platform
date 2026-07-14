import { z } from 'zod';
import { ReconciliationType } from './reconciliation';

/**
 * Submission upload reconciliation table record.
 */
export const SubmissionUploadReconciliation = z.object({
  submission_upload_reconciliation_id: z.number(),
  submission_upload_id: z.string().uuid(),
  reconciliation: ReconciliationType,
  count: z.number()
});

export type SubmissionUploadReconciliation = z.infer<typeof SubmissionUploadReconciliation>;

/**
 * Fields required to create a submission upload reconciliation record.
 */
export const CreateSubmissionUploadReconciliation = SubmissionUploadReconciliation.omit({
  submission_upload_reconciliation_id: true
});

export type CreateSubmissionUploadReconciliation = z.infer<typeof CreateSubmissionUploadReconciliation>;

/**
 * Mutable fields on a submission upload reconciliation record.
 */
export const UpdateSubmissionUploadReconciliation = z.object({
  count: z.number()
});

export type UpdateSubmissionUploadReconciliation = z.infer<typeof UpdateSubmissionUploadReconciliation>;
