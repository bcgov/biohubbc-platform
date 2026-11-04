import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  CreateSummaryMetric,
  SummaryMetric,
  SummaryMetricFilters,
  UpdateSummaryMetric
} from '../models/summary-metric';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const SUMMARY_METRIC_COLUMNS = [
  'summary_metric_id',
  'key',
  'name',
  'description',
  'record_effective_date',
  'record_end_date',
  'create_date'
] as const;

/** Dictionary CRUD; retired keys remain reserved for historical and calculator references. */
export class SummaryMetricRepository extends BaseRepository {
  /** Apply dictionary search to list and count queries. */
  applyFilters(query: Knex.QueryBuilder, filters?: SummaryMetricFilters): Knex.QueryBuilder {
    if (filters?.search) {
      query.where((builder) =>
        builder.whereILike('name', `%${filters.search}%`).orWhereILike('key', `%${filters.search}%`)
      );
    }
    return query;
  }

  /** List active dictionary records with the standard pagination helper. */
  async getSummaryMetrics(filters?: SummaryMetricFilters, pagination?: ApiPaginationOptions): Promise<SummaryMetric[]> {
    const knex = getKnex();
    const query = this.applyFilters(
      knex('summary_metrics').select(SUMMARY_METRIC_COLUMNS).whereNull('record_end_date'),
      filters
    );
    if (!pagination?.sort || !pagination.order) {
      query.orderBy('name', 'asc');
    }
    this.applyPagination(query, pagination);
    query.orderBy('summary_metric_id', 'asc');
    const result = await this.connection.knex(query, SummaryMetric);
    return result.rows;
  }

  /** Count active definitions using the same filters as the list. */
  async getSummaryMetricsCount(filters?: SummaryMetricFilters): Promise<number> {
    const knex = getKnex();
    const query = this.applyFilters(knex('summary_metrics').whereNull('record_end_date'), filters).select(
      knex.raw('count(*)::integer AS count')
    );
    const result = await this.connection.knex(query, CountResult);
    return result.rows[0].count;
  }

  /** Read an active dictionary record or return the conventional not-found error. */
  async getSummaryMetric(summaryMetricId: number): Promise<SummaryMetric> {
    const query = getKnex()('summary_metrics')
      .select(SUMMARY_METRIC_COLUMNS)
      .where('summary_metric_id', summaryMetricId)
      .whereNull('record_end_date');
    const result = await this.connection.knex(query, SummaryMetric);
    if (!result.rowCount) {
      throw new ApiNotFoundError('Summary metric not found', [{ summaryMetricId }]);
    }
    return result.rows[0];
  }

  /** Include retired keys when checking uniqueness: keys must never change meaning. */
  async findSummaryMetricByKey(key: string): Promise<SummaryMetric | undefined> {
    const query = getKnex()('summary_metrics').select(SUMMARY_METRIC_COLUMNS).where('key', key);
    const result = await this.connection.knex(query, SummaryMetric);
    return result.rows[0];
  }

  /** Create a metric definition. */
  async insertSummaryMetric(data: CreateSummaryMetric): Promise<SummaryMetric> {
    const query = getKnex()('summary_metrics')
      .insert({ key: data.key, name: data.name, description: data.description })
      .returning(SUMMARY_METRIC_COLUMNS);
    const result = await this.connection.knex(query, SummaryMetric);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert summary metric');
    }
    return result.rows[0];
  }

  /** Update metadata without rewriting a calculation key or historical foreign keys. */
  async updateSummaryMetric(summaryMetricId: number, data: UpdateSummaryMetric): Promise<SummaryMetric> {
    const query = getKnex()('summary_metrics')
      .where('summary_metric_id', summaryMetricId)
      .whereNull('record_end_date')
      .update({ name: data.name, description: data.description })
      .returning(SUMMARY_METRIC_COLUMNS);
    const result = await this.connection.knex(query, SummaryMetric);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update summary metric');
    }
    return result.rows[0];
  }

  /** Soft-delete the definition; calculated rows retain their foreign key and history. */
  async deleteSummaryMetric(summaryMetricId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('summary_metrics')
      .where('summary_metric_id', summaryMetricId)
      .whereNull('record_end_date')
      .update({ record_end_date: knex.fn.now() });
    const result = await this.connection.knex(query);
    if (result.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete summary metric');
    }
  }
}
