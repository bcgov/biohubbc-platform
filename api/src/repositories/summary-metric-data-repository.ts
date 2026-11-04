import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  CreateSummaryMetricData,
  LatestSummaryMetricData,
  SummaryMetricData,
  SummaryMetricDataFilters,
  UpdateSummaryMetricData
} from '../models/summary-metric-data';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const SUMMARY_METRIC_DATA_COLUMNS = [
  'summary_metrics_data_id',
  'summary_metric_id',
  'run_id',
  'calculated_at',
  'value',
  'record_effective_date',
  'record_end_date',
  'create_date'
] as const;

/** CRUD and latest-value queries for calculated summary metrics. */
export class SummaryMetricDataRepository extends BaseRepository {
  /** Apply optional dictionary/run filters consistently to list and count. */
  applyFilters(query: Knex.QueryBuilder, filters?: SummaryMetricDataFilters): Knex.QueryBuilder {
    if (filters?.summary_metric_id !== undefined) {
      query.where('summary_metric_id', filters.summary_metric_id);
    }
    if (filters?.run_id) {
      query.where('run_id', filters.run_id);
    }
    return query;
  }

  /** List active values, including history belonging to retired definitions. */
  async getSummaryMetricsData(
    filters?: SummaryMetricDataFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SummaryMetricData[]> {
    const query = this.applyFilters(
      getKnex()('summary_metrics_data').select(SUMMARY_METRIC_DATA_COLUMNS).whereNull('record_end_date'),
      filters
    );
    if (!pagination?.sort || !pagination.order) {
      query.orderBy('calculated_at', 'desc');
    }
    this.applyPagination(query, pagination);
    query.orderBy('summary_metrics_data_id', 'desc');
    const result = await this.connection.knex(query, SummaryMetricData);
    return result.rows;
  }

  /** Count active calculated values. */
  async getSummaryMetricsDataCount(filters?: SummaryMetricDataFilters): Promise<number> {
    const knex = getKnex();
    const query = this.applyFilters(knex('summary_metrics_data').whereNull('record_end_date'), filters).select(
      knex.raw('count(*)::integer AS count')
    );
    const result = await this.connection.knex(query, CountResult);
    return result.rows[0].count;
  }

  /** Read an active value by its bigint identifier. */
  async getSummaryMetricData(summaryMetricsDataId: string): Promise<SummaryMetricData> {
    const query = getKnex()('summary_metrics_data')
      .select(SUMMARY_METRIC_DATA_COLUMNS)
      .where('summary_metrics_data_id', summaryMetricsDataId)
      .whereNull('record_end_date');
    const result = await this.connection.knex(query, SummaryMetricData);
    if (!result.rowCount) {
      throw new ApiNotFoundError('Summary metric data not found', [{ summaryMetricsDataId }]);
    }
    return result.rows[0];
  }

  /** Run/metric uniqueness includes retired values, preserving the identity of historical snapshots. */
  async findSummaryMetricDataByRun(runId: string, summaryMetricId: number): Promise<SummaryMetricData | undefined> {
    const query = getKnex()('summary_metrics_data')
      .select(SUMMARY_METRIC_DATA_COLUMNS)
      .where('run_id', runId)
      .where('summary_metric_id', summaryMetricId);
    const result = await this.connection.knex(query, SummaryMetricData);
    return result.rows[0];
  }

  /** Create a calculated value; serialize scalar strings as JSON as well as objects and arrays. */
  async insertSummaryMetricData(data: CreateSummaryMetricData): Promise<SummaryMetricData> {
    const knex = getKnex();
    const query = knex('summary_metrics_data')
      .insert({
        summary_metric_id: data.summary_metric_id,
        run_id: data.run_id,
        calculated_at: data.calculated_at,
        value: data.value === null ? null : knex.raw('?::jsonb', [JSON.stringify(data.value)])
      })
      .returning(SUMMARY_METRIC_DATA_COLUMNS);
    const result = await this.connection.knex(query, SummaryMetricData);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert summary metric data');
    }
    return result.rows[0];
  }

  /** Correct the value without reassigning a metric, run, or calculation timestamp. */
  async updateSummaryMetricData(
    summaryMetricsDataId: string,
    data: UpdateSummaryMetricData
  ): Promise<SummaryMetricData> {
    const knex = getKnex();
    const query = knex('summary_metrics_data')
      .where('summary_metrics_data_id', summaryMetricsDataId)
      .whereNull('record_end_date')
      .update({ value: data.value === null ? null : knex.raw('?::jsonb', [JSON.stringify(data.value)]) })
      .returning(SUMMARY_METRIC_DATA_COLUMNS);
    const result = await this.connection.knex(query, SummaryMetricData);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update summary metric data');
    }
    return result.rows[0];
  }

  /** Retire a calculated value without destroying snapshot history. */
  async deleteSummaryMetricData(summaryMetricsDataId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('summary_metrics_data')
      .where('summary_metrics_data_id', summaryMetricsDataId)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    const result = await this.connection.knex(query);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete summary metric data');
    }
  }

  /** Latest effective, non-ended value per active dictionary metric, with a deterministic ID tie-breaker. */
  async getLatestSummaryMetricsData(): Promise<LatestSummaryMetricData[]> {
    const result = await this.connection.sql(
      SQL`
      SELECT data.summary_metrics_data_id, metric.summary_metric_id,
             data.run_id, data.calculated_at, data.value, metric.key, metric.name, metric.description
      FROM summary_metrics metric
      JOIN LATERAL (
        SELECT summary_metrics_data_id, run_id, calculated_at, value
        FROM summary_metrics_data
        WHERE summary_metric_id = metric.summary_metric_id
          AND record_end_date IS NULL
          AND record_effective_date <= now()
          AND calculated_at <= now()
        ORDER BY calculated_at DESC, summary_metrics_data_id DESC
        LIMIT 1
      ) data ON true
      WHERE metric.record_end_date IS NULL AND metric.record_effective_date <= now()
      ORDER BY metric.summary_metric_id;
    `,
      LatestSummaryMetricData
    );
    return result.rows;
  }
}
