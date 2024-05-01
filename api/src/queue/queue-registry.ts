import { getAPIUserDBConnection } from '../database/db';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('queue/queue-registry');

type QueueJob = (jobQueueRecord: ISubmissionJobQueueRecord) => Promise<any>;

/**
 * Translates a string to a queue-job compatible function.
 */
export const QueueJobRegistry: { registry: any[]; findMatchingJob: (name: string) => QueueJob | undefined } = {
  registry: [],
  /**
   * Find a job in the registry.
   *
   * @param {string} name The name of the job in the registry.
   * @return {*}  {(QueueJob | undefined)}
   */
  findMatchingJob(name: string): QueueJob | undefined {
    return this.registry.find((item) => item.name === name)?.generator;
  }
};

/**
 * Wraps a queue job function. Will prefix the job execution with an update to the attempt count for the queue record.
 *
 * @param {QueueJob} job The job function to run, after incrementing the attempt count.
 * @return {*}  {QueueJob}
 */
export function jobQueueAttemptsWrapper(queueJob: QueueJob): QueueJob {
  return async function wrappedQueueJob(jobQueueRecord: ISubmissionJobQueueRecord) {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);
      // Increment job queue record attempts count
      await jobQueueService.incrementAttemptCount(jobQueueRecord.submission_job_queue_id);
    } catch (error) {
      defaultLog.error({ label: 'wrappedQueueJob', message: 'error', error });
      throw error;
    } finally {
      await connection.commit();
      connection.release();
    }

    // Execute original job function
    return queueJob(jobQueueRecord);
  };
}
