import { IDBConnection } from '../database/db';
import { SubmissionMetricRecord } from '../models/submission-metrics';
import { SubmissionMetricsRepository } from '../repositories/submission-metrics-repository';
import { DBService } from './db-service';

/** Service for calculating and reading platform submission metric snapshots. */
export class SubmissionMetricsService extends DBService {
  submissionMetricsRepository: SubmissionMetricsRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionMetricsRepository = new SubmissionMetricsRepository(connection);
  }

  /** Calculate a complete snapshot within the caller's transaction and return its run ID. */
  async calculateMetrics(): Promise<string> {
    return this.submissionMetricsRepository.calculateMetrics();
  }

  /** Read all calculated metrics belonging to one snapshot. */
  async getMetricsByRunId(runId: string): Promise<SubmissionMetricRecord[]> {
    return this.submissionMetricsRepository.getMetricsByRunId(runId);
  }
}
