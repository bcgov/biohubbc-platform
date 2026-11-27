import { z } from 'zod';

export const SummaryMetricData = z.object({
  // PostgreSQL bigint identifiers are returned as strings to preserve precision.
  summary_metrics_data_id: z.string(),
  summary_metric_id: z.number(),
  run_id: z.string().uuid(),
  calculated_at: z.string(),
  value: z.unknown().nullable(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string()
});
export type SummaryMetricData = z.infer<typeof SummaryMetricData>;

export const LatestSummaryMetricData = SummaryMetricData.pick({
  summary_metrics_data_id: true,
  summary_metric_id: true,
  run_id: true,
  calculated_at: true,
  value: true
}).extend({ key: z.string(), name: z.string(), description: z.string() });
export type LatestSummaryMetricData = z.infer<typeof LatestSummaryMetricData>;

export interface SummaryMetricDataFilters {
  summary_metric_id?: number;
  run_id?: string;
}

export interface CreateSummaryMetricData {
  summary_metric_id: number;
  run_id: string;
  calculated_at: string;
  value: unknown;
}

/** Correct a value without changing the metric or calculation run it belongs to. */
export interface UpdateSummaryMetricData {
  value: unknown;
}
