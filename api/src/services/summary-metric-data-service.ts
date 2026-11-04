import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import {
  CreateSummaryMetricData,
  LatestSummaryMetricData,
  SummaryMetricData,
  SummaryMetricDataFilters,
  UpdateSummaryMetricData
} from '../models/summary-metric-data';
import { SummaryMetricDataRepository } from '../repositories/summary-metric-data-repository';
import { SummaryMetricRepository } from '../repositories/summary-metric-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/** Administrative calculated-value CRUD and the public latest-value read. */
export class SummaryMetricDataService extends DBService {
  summaryMetricDataRepository: SummaryMetricDataRepository;
  summaryMetricRepository: SummaryMetricRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.summaryMetricDataRepository = new SummaryMetricDataRepository(connection);
    this.summaryMetricRepository = new SummaryMetricRepository(connection);
  }

  /** List historical active values with standard pagination. */
  async getSummaryMetricsData(
    filters?: SummaryMetricDataFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SummaryMetricData[]> {
    if (
      pagination?.sort &&
      !['summary_metrics_data_id', 'summary_metric_id', 'calculated_at', 'create_date'].includes(pagination.sort)
    ) {
      throw new HTTP400('Invalid summary metric data sort column');
    }
    return this.summaryMetricDataRepository.getSummaryMetricsData(filters, pagination);
  }

  /** Count historical active values. */
  async getSummaryMetricsDataCount(filters?: SummaryMetricDataFilters): Promise<number> {
    return this.summaryMetricDataRepository.getSummaryMetricsDataCount(filters);
  }

  /** Read a single calculated value. */
  async getSummaryMetricData(summaryMetricsDataId: string): Promise<SummaryMetricData> {
    if (!/^[1-9][0-9]{0,18}$/.test(summaryMetricsDataId) || BigInt(summaryMetricsDataId) > 9223372036854775807n) {
      throw new HTTP400('Invalid summary metric data identifier');
    }
    return this.summaryMetricDataRepository.getSummaryMetricData(summaryMetricsDataId);
  }

  /** Create a value only for an active definition and unused run/metric pair. */
  async createSummaryMetricData(data: CreateSummaryMetricData): Promise<SummaryMetricData> {
    await this.summaryMetricRepository.getSummaryMetric(data.summary_metric_id);
    if (await this.summaryMetricDataRepository.findSummaryMetricDataByRun(data.run_id, data.summary_metric_id)) {
      throw new ApiConflictError('A value for this summary metric and run already exists');
    }
    return this.summaryMetricDataRepository.insertSummaryMetricData(data);
  }

  /** Correct a calculated value without moving it into another snapshot. */
  async updateSummaryMetricData(
    summaryMetricsDataId: string,
    data: UpdateSummaryMetricData
  ): Promise<SummaryMetricData> {
    await this.getSummaryMetricData(summaryMetricsDataId);
    return this.summaryMetricDataRepository.updateSummaryMetricData(summaryMetricsDataId, data);
  }

  /** Soft-delete a calculated value. */
  async deleteSummaryMetricData(summaryMetricsDataId: string): Promise<void> {
    await this.getSummaryMetricData(summaryMetricsDataId);
    await this.summaryMetricDataRepository.deleteSummaryMetricData(summaryMetricsDataId);
  }

  /** Latest available active value for each active dictionary metric; empty before any calculation. */
  async getLatestSummaryMetricsData(): Promise<LatestSummaryMetricData[]> {
    return this.summaryMetricDataRepository.getLatestSummaryMetricsData();
  }
}
