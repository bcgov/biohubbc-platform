import { z } from 'zod';

/**
 * Grouped deep-validation error count row for one submission upload.
 */
export const IngestionErrorCountRow = z.object({
  error_code: z.string(),
  error_count: z.number()
});

/**
 * Deep-validation aggregated error summary row for diagnostics/logging.
 */
export const IngestionErrorSummaryRow = z.object({
  property_name: z.string().nullable(),
  blueprint_feature_type_property_id: z.number().nullable(),
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
 * Representative deep-validation aggregated error summary for diagnostics/logging.
 */
export type IngestionErrorSummary = z.infer<typeof IngestionErrorSummaryRow>;
