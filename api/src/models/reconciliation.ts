import { z } from 'zod';
import { SearchFeatureResultWithRelevancy } from '../services/search-feature-service.interface';
import { ApiCursorPaginationResults } from '../zod-schema/pagination';
import { SearchFeatureProperty } from './feature-property';

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

/** A feature type represented in a stored reconciliation outcome. */
export const ReconciliationFeatureTypeCount = z.object({
  feature_type_name: z.string(),
  count: z.number().int().nonnegative()
});

export type ReconciliationFeatureTypeCount = z.infer<typeof ReconciliationFeatureTypeCount>;

/** Outcome totals across the complete upload lifecycle. */
export interface ReconciliationFeatureCounts {
  total: number;
  feature_types: ReconciliationFeatureTypeCount[];
}

/** Hydrated reconciliation results and cursor metadata. */
export interface ReconciliationFeaturePage {
  features: SearchFeatureResultWithRelevancy[];
  properties: SearchFeatureProperty[];
  pagination: ApiCursorPaginationResults;
}
