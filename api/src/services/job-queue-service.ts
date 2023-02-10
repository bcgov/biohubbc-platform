import { IDBConnection } from '../database/db';
import { IJobQueueRecord, JobQueueRepository } from '../repositories/job-queue-repositry';
import { DBService } from './db-service';

export class JobQueueService extends DBService {
  jobQueueRepository: JobQueueRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.jobQueueRepository = new JobQueueRepository(connection);
  }

  /**
   * Fetch the next available job queue record(s).
   *
   * @param {number} [concurrency] The number of job queue processes that can run concurrently (integer > 0).
   * @param {number} [attempts] The total number of times a job will be attempted until it finishes successfully (integer >= 1).
   * @param {number} [timeout] The maximum duration a running job can take before it is considered timed out.
   * @return {*}  {Promise<IJobQueueRecord[]>}
   * @memberof JobQueueService
   */
  async getNextUnprocessedJobQueueRecords(
    concurrency?: number,
    attempts?: number,
    timeout?: number
  ): Promise<IJobQueueRecord[]> {
    return this.jobQueueRepository.getNextUnprocessedJobQueueRecords(concurrency, attempts, timeout);
  }

  /**
   * Update a job queue record, setting the start time to now.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<IJobQueueRecord>}
   * @memberof JobQueueService
   */
  async startQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    return this.jobQueueRepository.startQueueRecord(jobQueueId);
  }

  /**
   * Update a job queue record, setting the end time to now.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<IJobQueueRecord>}
   * @memberof JobQueueService
   */
  async endJobQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    return this.jobQueueRepository.endJobQueueRecord(jobQueueId);
  }

  /**
   * Update a job queue record, setting the start and end times to null.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<IJobQueueRecord>}
   * @memberof JobQueueService
   */
  async resetJobQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    return this.jobQueueRepository.resetJobQueueRecord(jobQueueId);
  }
}
