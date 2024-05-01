import fastq from 'fastq';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { QueueJobRegistry } from './queue-registry';
import { QUEUE_DEFAULT_CONCURRENCY, QUEUE_DEFAULT_TIMEOUT } from './queue-scheduler';

export class Queue {
  /**
   * The in memory queue that controls the dispatch of queue jobs.
   *
   * @type {fastq.queueAsPromised}
   * @memberof Queue
   */
  _queue: fastq.queueAsPromised;

  /**
   * Queue timeout, used to auto reject jobs if they run for longer than the specified timeout.
   *
   * @type {number}
   * @memberof Queue
   */
  _timeout: number = QUEUE_DEFAULT_TIMEOUT;

  /**
   * Creates an instance of Queue.
   *
   * @memberof Queue
   */
  constructor() {
    this._queue = fastq.promise(this, this._queueWorker, QUEUE_DEFAULT_CONCURRENCY);
  }

  /**
   * The function that is executed for each item added to the queue.
   *
   * This will find and execute a job function for the given job queue record.
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @return {*}
   * @memberof Queue
   */
  async _queueWorker(jobQueueRecord: ISubmissionJobQueueRecord) {
    const job = QueueJobRegistry.findMatchingJob('placeholder-not_a_real_job');

    if (!job) {
      throw new Error('Failed to find matching queue job handler');
    }

    // Race the job promise with a timeout promise. If the timeout promise resolves first, the job promise will be
    // rejected (considered timed out).
    return Promise.race([job(jobQueueRecord), this._getJobTimeout()]);
  }

  /**
   * Add a new item to the queue.
   *
   * Note: If the number of running jobs is less than the concurrency value, then this job will be started almost
   * immediately. Otherwise it will be added to the queue, awaiting job execution.
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @return {*}
   * @memberof Queue
   */
  async addJobToQueue(jobQueueRecord: ISubmissionJobQueueRecord) {
    return this._queue.push(jobQueueRecord);
  }

  /**
   * The current length of the queue.
   *
   * Note: This length is based on the number of items in the queue that are pending job execution. It does not include
   * items whose jobs have already been executed, even if they are still in the process of running.
   *
   * @return {*}  {number}
   * @memberof Queue
   */
  getJobQueueLength(): number {
    return this._queue.length();
  }

  /**
   * Update the concurrency of the queue, controlling how many jobs can execute in parallel.
   *
   * @param {number} concurrency
   * @memberof Queue
   */
  setJobQueueConcurrency(concurrency: number) {
    this._queue.concurrency = concurrency;
  }

  /**
   * Update the job timeout, which will reject a running job if it executes for longer than the timeout time.
   *
   * @param {number} timeout
   * @memberof Queue
   */
  setJobTimeout(timeout: number) {
    this._timeout = timeout;
  }

  /**
   * Returns a promise that auto rejects after a set timeout.
   *
   * @return {*}
   * @memberof Queue
   */
  _getJobTimeout() {
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(`Queue job timeout after ${this._timeout} milliseconds`), this._timeout);
    });
  }
}
