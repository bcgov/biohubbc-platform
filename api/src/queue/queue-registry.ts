import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';

type QueueJob = (jobQueueRecord: ISubmissionJobQueueRecord) => Promise<any>;

/**
 * Translates a string to a queue-job compatible function.
 */
export const QueueJobRegistry = {
  registry: [
    {
      name: 'dwc_dataset_submission',
      generator: getDummyQueueJob
    }
  ],
  findMatchingJob(name: string): QueueJob | undefined {
    return this.registry.find((item) => item.name === name)?.generator;
  }
};

/**
 * TODO Temporary - delete and replace the above reference in the registry with the actual function handles dwc
 * submission intake.
 *
 * @return {*}
 */
function getDummyQueueJob(jobQueueRecord: ISubmissionJobQueueRecord) {
  return new Promise((resolve, reject) => {
    const timeout = Math.round(Math.random() * 10000);
    if (timeout < 20000) {
      setTimeout(() => resolve(`Resolved: ${jobQueueRecord.submission_job_queue_id}`), timeout);
    } else {
      setTimeout(() => reject(`!! Rejected: ${jobQueueRecord.submission_job_queue_id}`), timeout);
    }
  });
}
