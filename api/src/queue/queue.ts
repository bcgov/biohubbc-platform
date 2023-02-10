import fastq from 'fastq';
import { IJobQueueRecord } from '../repositories/job-queue-repositry';
import { QueueJobRegistry } from './queue-registry';
import { QUEUE_DEFAULT_CONCURRENCY, QUEUE_DEFAULT_TIMEOUT } from './queue-scheduler';

export class Queue {
  _queue: fastq.queueAsPromised;

  _timeout: number = QUEUE_DEFAULT_TIMEOUT;

  constructor() {
    this._queue = fastq.promise(this, this._queueWorker, QUEUE_DEFAULT_CONCURRENCY);
  }

  async _queueWorker(jobQueueRecord: IJobQueueRecord) {
    const job = QueueJobRegistry.findMatchingJob('dwc_dataset_submission');

    if (!job) {
      throw new Error('Failed to find matching queue job handler');
    }

    return Promise.race([job(jobQueueRecord), this._getJobTimeout()]);
  }

  async addJobToQueue(jobQueueRecord: IJobQueueRecord) {
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
