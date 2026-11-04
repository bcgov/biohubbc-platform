import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { SubmissionMetricRecord } from '../models/submission-metrics';
import { BaseRepository } from './base-repository';
import { isSubmissionFeatureCurrent } from './sql-fragments';

/** Writes complete platform snapshots from published features whose closure is ready. */
export class SubmissionMetricsRepository extends BaseRepository {
  /**
   * Calculate and insert all metrics in one statement so every aggregate sees the same source snapshot.
   * Records are current features, surveys are features of type `survey`, and the date range covers
   * indexed submitted date values (excluding audit/publication timestamps and time-only values).
   * Secured features still contribute: approval and public visibility are different concerns.
   */
  async calculateMetrics(): Promise<string> {
    const runId = randomUUID();
    const statement = SQL`
      WITH snapshot AS MATERIALIZED (
        SELECT ${runId}::uuid AS run_id, statement_timestamp() AS calculated_at
      ), eligible_features AS MATERIALIZED (
        SELECT sf.submission_feature_id, sf.submission_id, ft.name AS feature_type
        FROM submission_feature sf
        JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
        WHERE `;
    statement.append(isSubmissionFeatureCurrent('sf'));
    statement.append(`
          AND EXISTS (
            SELECT 1 FROM submission_feature_closure c
            WHERE c.source_submission_feature_id = sf.submission_feature_id
              AND c.target_submission_feature_id = sf.submission_feature_id
          )
      ), counts AS (
        SELECT count(*) AS record_count,
               count(DISTINCT submission_id) AS submission_count,
               count(*) FILTER (WHERE feature_type = 'survey') AS survey_count
        FROM eligible_features
      ), dates AS (
        SELECT min(p.date_value) AS earliest_date, max(p.date_value) AS latest_date
        FROM submission_feature_property_timestamp p
        JOIN eligible_features sf USING (submission_feature_id)
      ), computed_metrics AS (
        SELECT metrics.key, metrics.value
        FROM counts CROSS JOIN dates
        CROSS JOIN LATERAL (VALUES
          ('record_count', to_jsonb(record_count)),
          ('submission_count', to_jsonb(submission_count)),
          ('survey_count', to_jsonb(survey_count)),
          ('earliest_date', to_jsonb(earliest_date)),
          ('latest_date', to_jsonb(latest_date))
        ) AS metrics(key, value)
      )
      INSERT INTO summary_metrics_data (summary_metric_id, run_id, calculated_at, value)
      SELECT dictionary.summary_metric_id, snapshot.run_id, snapshot.calculated_at, computed.value
      FROM computed_metrics computed
      JOIN summary_metrics dictionary ON dictionary.key = computed.key
      CROSS JOIN snapshot
      WHERE dictionary.record_end_date IS NULL
        AND dictionary.record_effective_date <= now();
    `);
    // Dictionary retirement intentionally removes a metric from future calculations. The single
    // INSERT still commits every enabled calculation atomically, including when none are enabled.
    await this.connection.sql(statement);
    return runId;
  }

  /** Read the metric values in a single calculation run. */
  async getMetricsByRunId(runId: string): Promise<SubmissionMetricRecord[]> {
    const response = await this.connection.sql(
      SQL`
      SELECT data.run_id, data.calculated_at, metric.key, data.value
      FROM summary_metrics_data data
      JOIN summary_metrics metric USING (summary_metric_id)
      WHERE data.run_id = ${runId}
      ORDER BY metric.summary_metric_id;
    `,
      SubmissionMetricRecord
    );
    return response.rows;
  }
}
