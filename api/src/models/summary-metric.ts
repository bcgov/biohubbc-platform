import { z } from 'zod';

export const SummaryMetric = z.object({
  summary_metric_id: z.number(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string()
});
export type SummaryMetric = z.infer<typeof SummaryMetric>;

export interface SummaryMetricFilters {
  search?: string;
}

export interface CreateSummaryMetric {
  key: string;
  name: string;
  description: string;
}

/** The calculation key is immutable; change descriptive metadata only. */
export interface UpdateSummaryMetric {
  name: string;
  description: string;
}
