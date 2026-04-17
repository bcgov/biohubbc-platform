import { z } from 'zod';

/**
 * Grouped deep-validation error count row for one submission upload.
 */
export const IngestionErrorCountRow = z.object({
  error_code: z.string(),
  error_count: z.number()
});

/**
 * Total deep-validation error count row for one submission upload.
 */
export const IngestionErrorTotalCountRow = z.object({
  count: z.number()
});

/**
 * Deep-validation aggregated error summary row for diagnostics/logging.
 */
export const IngestionErrorSummaryRow = z.object({
  property_name: z.string().nullable(),
  feature_type_property_id: z.number().nullable(),
  error_code: z.string(),
  error_message: z.string(),
  count: z.number(),
  details: z.any().nullable()
});

/**
 * Grouped deep-validation error count by code for one submission upload.
 */
export type IngestionErrorCount = z.infer<typeof IngestionErrorCountRow>;

/**
 * Total deep-validation error count for one submission upload.
 */
export type IngestionErrorTotalCount = z.infer<typeof IngestionErrorTotalCountRow>;

/**
 * Representative deep-validation aggregated error summary for diagnostics/logging.
 */
export type IngestionErrorSummary = z.infer<typeof IngestionErrorSummaryRow>;
