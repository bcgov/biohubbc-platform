import { z } from 'zod';

/**
 * Classifications stored by the submission feature reconciliation enum.
 */
export const ReconciliationType = z.enum(['new', 'unchanged', 'superseded', 'conflict']);

export type ReconciliationType = z.infer<typeof ReconciliationType>;

/**
 * Complete reconciliation counts returned by reconciliation workflows.
 */
export const ReconciliationCounts = z.object({
  new: z.number(),
  unchanged: z.number(),
  superseded: z.number(),
  conflict: z.number()
});

export type ReconciliationCounts = z.infer<typeof ReconciliationCounts>;

/**
 * Database row containing non-null reconciliation counts.
 */
export const ReconciliationCountsResult = z.object({
  reconciliation: ReconciliationCounts
});

export type ReconciliationCountsResult = z.infer<typeof ReconciliationCountsResult>;

/**
 * Database row containing the reconciliation summary for an upload.
 */
export const SubmissionUploadReconciliationCounts = z.object({
  reconciliation: ReconciliationCounts.nullable()
});

export type SubmissionUploadReconciliationCounts = z.infer<typeof SubmissionUploadReconciliationCounts>;
