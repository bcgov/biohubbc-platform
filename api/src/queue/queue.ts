import fastq from 'fastq';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { DWC_DATASET_SUBMISSION_JOB, QueueJobRegistry } from './queue-registry';
import { QUEUE_DEFAULT_CONCURRENCY, QUEUE_DEFAULT_TIMEOUT } from './queue-scheduler';

export class Queue {
  _queue: fastq.queueAsPromised;

  _timeout: number = QUEUE_DEFAULT_TIMEOUT;

  constructor() {
    this._queue = fastq.promise(this, this._queueWorker, QUEUE_DEFAULT_CONCURRENCY);
  }

  async _queueWorker(jobQueueRecord: ISubmissionJobQueueRecord) {
    const job = QueueJobRegistry.findMatchingJob(DWC_DATASET_SUBMISSION_JOB);

    if (!job) {
      throw new Error('Failed to find matching queue job handler');
    }

    // Race the job promise with a timeout promise. If the timeout promise resolves first, the job promise will be
    // rejected (considered timed out).
    return Promise.race([job(jobQueueRecord), this._getJobTimeout()]);
  }

  async addJobToQueue(jobQueueRecord: ISubmissionJobQueueRecord) {
    return this._queue.push(jobQueueRecord);
  }

  getJobQueueLength(): number {
    return this._queue.length();
  }

  setJobQueueConcurrency(concurrency: number) {
    this._queue.concurrency = concurrency;
  }

  setJobTimeout(timeout: number) {
    this._timeout = timeout;
  }

  _getJobTimeout() {
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(`Queue job timeout after ${this._timeout} milliseconds`), this._timeout);
    });
  }
}
