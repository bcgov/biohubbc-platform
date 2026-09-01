import { z } from 'zod';

/**
 * Classifications stored by the submission feature reconciliation enum.
 */
export const ReconciliationType = z.enum(['new', 'modified', 'unmodified']);

export type ReconciliationType = z.infer<typeof ReconciliationType>;

/** A reconciliation classification and its aggregate row count. */
export const ReconciliationCountRow = z.object({
  reconciliation: ReconciliationType,
  count: z.number()
});

export type ReconciliationCountRow = z.infer<typeof ReconciliationCountRow>;

/**
 * Complete reconciliation counts returned by reconciliation workflows.
 */
export const ReconciliationCounts = z.object({
  new: z.number(),
  modified: z.number(),
  unmodified: z.number()
});

export type ReconciliationCounts = z.infer<typeof ReconciliationCounts>;
