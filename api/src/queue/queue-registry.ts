import { getAPIUserDBConnection } from '../database/db';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';

type QueueJob = (jobQueueRecord: ISubmissionJobQueueRecord) => Promise<any>;

/**
 * Translates a string to a queue-job compatible function.
 */
export const QueueJobRegistry = {
  registry: [
    {
      name: 'dwc_dataset_submission',
      generator: jobQueueAttemptsWrapper(getTestJob('random', 10000))
    }
  ],
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
    await connection.open();

    // Increment attempt count
    const jobQueueService = new SubmissionJobQueueService(connection);
    await jobQueueService.incrementAttemptCount(jobQueueRecord.submission_job_queue_id);

    await connection.commit();
    connection.release();

    // Execute original job function
    return queueJob(jobQueueRecord);
  };
}

/**
 * Returns a job queue generator function that auto resolves or rejects after a random timeout.
 *
 * @param {('resolve' | 'reject' | 'random')} type controls the behaviour of the test function.
 * - `resolve` will always resolve
 * - `reject` will always reject
 * - `random` will resolve when timeout is even, reject when timeout is odd.
 * @param {number} maxTimeout maximum time before auto resolving or rejecting. If `type` is set to `random`, `timeout`
 * will be used as the maximum timeout when generating random timeouts.
 * @return {*}  {QueueJob}
 */
function getTestJob(type: 'resolve' | 'reject' | 'random', maxTimeout: number): QueueJob {
  return function testJob(jobQueueRecord: ISubmissionJobQueueRecord) {
    return new Promise((resolve, reject) => {
      const randomTimeout = Math.round(Math.random() * maxTimeout);
      if (type === 'resolve') {
        setTimeout(() => resolve(`Resolved: ${jobQueueRecord.submission_job_queue_id}`), randomTimeout);
      } else if (type === 'reject') {
        setTimeout(() => reject(`Rejected: ${jobQueueRecord.submission_job_queue_id}`), randomTimeout);
      } else {
        if (randomTimeout % 2 === 0) {
          setTimeout(() => resolve(`Resolved: ${jobQueueRecord.submission_job_queue_id}`), randomTimeout);
        } else {
          setTimeout(() => reject(`Rejected: ${jobQueueRecord.submission_job_queue_id}`), randomTimeout);
        }
      }
    });
  };
}
