import { z } from 'zod';
import { ApiPaginationResults } from '../zod-schema/pagination';

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

/** Required ownership and stored outcome for reconciliation browsing. */
export interface ReconciliationFeatureScope {
  submissionId: number;
  submissionUploadId: string;
  reconciliation: ReconciliationType;
}

/** Columns the raw reconciliation feature data list can be sorted on. */
export const RECONCILIATION_FEATURE_DATA_SORT_COLUMNS = ['submission_feature_id'];

/** A stored reconciliation feature and its raw submitted jsonb payload. */
export const ReconciliationFeatureData = z.object({
  submission_feature_id: z.number(),
  data: z.record(z.string(), z.any())
});

export type ReconciliationFeatureData = z.infer<typeof ReconciliationFeatureData>;

/** One page of raw reconciliation feature data and its pagination totals. */
export interface ReconciliationFeatureDataPage {
  features: ReconciliationFeatureData[];
  pagination: ApiPaginationResults;
}
