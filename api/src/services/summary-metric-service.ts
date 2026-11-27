import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import {
  CreateSummaryMetric,
  SummaryMetric,
  SummaryMetricFilters,
  UpdateSummaryMetric
} from '../models/summary-metric';
import { SummaryMetricRepository } from '../repositories/summary-metric-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/** Admin dictionary operations; deletion retires definitions while retaining historical keys. */
export class SummaryMetricService extends DBService {
  summaryMetricRepository: SummaryMetricRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.summaryMetricRepository = new SummaryMetricRepository(connection);
  }

  /** List active metric definitions. */
  async getSummaryMetrics(filters?: SummaryMetricFilters, pagination?: ApiPaginationOptions): Promise<SummaryMetric[]> {
    if (pagination?.sort && !['summary_metric_id', 'key', 'name', 'create_date'].includes(pagination.sort)) {
      throw new HTTP400('Invalid summary metric sort column');
    }
    return this.summaryMetricRepository.getSummaryMetrics(filters, pagination);
  }

  /** Count active metric definitions. */
  async getSummaryMetricsCount(filters?: SummaryMetricFilters): Promise<number> {
    return this.summaryMetricRepository.getSummaryMetricsCount(filters);
  }

  /** Read an active metric definition. */
  async getSummaryMetric(summaryMetricId: number): Promise<SummaryMetric> {
    return this.summaryMetricRepository.getSummaryMetric(summaryMetricId);
  }

  /** Reject duplicate keys even if the earlier definition has been retired. */
  async createSummaryMetric(data: CreateSummaryMetric): Promise<SummaryMetric> {
    if (await this.summaryMetricRepository.findSummaryMetricByKey(data.key)) {
      throw new ApiConflictError('A summary metric with this key already exists');
    }
    return this.summaryMetricRepository.insertSummaryMetric(data);
  }

  /** Update descriptive metadata only. */
  async updateSummaryMetric(summaryMetricId: number, data: UpdateSummaryMetric): Promise<SummaryMetric> {
    await this.summaryMetricRepository.getSummaryMetric(summaryMetricId);
    return this.summaryMetricRepository.updateSummaryMetric(summaryMetricId, data);
  }

  /** Soft-delete a dictionary row without cascading deletion to its values. */
  async deleteSummaryMetric(summaryMetricId: number): Promise<void> {
    await this.summaryMetricRepository.getSummaryMetric(summaryMetricId);
    await this.summaryMetricRepository.deleteSummaryMetric(summaryMetricId);
  }
}
