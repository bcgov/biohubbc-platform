/** Latest active value and dictionary metadata returned for a summary metric. */
export interface LatestSummaryMetric {
  summary_metrics_data_id: string;
  summary_metric_id: number;
  run_id: string;
  calculated_at: string;
  value: unknown;
  key: string;
  name: string;
  description: string;
}

/** Response from GET /api/summary-metrics-data/latest. */
export interface LatestSummaryMetricsResponse {
  summary_metrics_data: LatestSummaryMetric[];
}
