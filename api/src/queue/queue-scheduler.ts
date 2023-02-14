import { getAPIUserDBConnection } from '../database/db';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';
import { SystemConstantService } from '../services/system-constant-service';
import { getLogger } from '../utils/logger';
import { Queue } from './queue';

const defaultLog = getLogger('queue/queue-scheduler');

export const QUEUE_DEFAULT_ENABLED = false;
export const QUEUE_DEFAULT_CONCURRENCY = 4;
export const QUEUE_DEFAULT_PERIOD = 5000; // 5 seconds
export const QUEUE_DEFAULT_ATTEMPTS = 2;
export const QUEUE_DEFAULT_TIMEOUT = 600000; // 10 minutes

export class QueueScheduler {
  _enabled = QUEUE_DEFAULT_ENABLED;
  _concurrency = QUEUE_DEFAULT_CONCURRENCY;
  _period = QUEUE_DEFAULT_PERIOD;
  _attempts = QUEUE_DEFAULT_ATTEMPTS;
  _timeout = QUEUE_DEFAULT_TIMEOUT;

  _queue: Queue;

  constructor() {
    this._queue = new Queue();

    this._start();
  }

  async _start() {
    // Check for updated queue settings
    await this._updateJobQueueSettings();

    // Process a round of jobs, if any unprocessed queue records exists
    this._processJobQueueRecords();

    // Wait for a period of time before looping
    setTimeout(() => this._start(), this._period);
  }

  /**
   * Fetch and apply any queue related settings.
   *
   * @return {*}  {Promise<void>}
   * @memberof QueueScheduler
   */
  async _updateJobQueueSettings(): Promise<void> {
    const connection = getAPIUserDBConnection();
    await connection.open();

    const systemConstantService = new SystemConstantService(connection);

    // Fetch all job queue constants
    const jobQueueConstants = await systemConstantService.getSystemConstants([
      'JOB_QUEUE_ENABLED',
      'JOB_QUEUE_CONCURRENCY',
      'JOB_QUEUE_PERIOD',
      'JOB_QUEUE_ATTEMPTS',
      'JOB_QUEUE_TIMEOUT'
    ]);

    const jobQueueEnabled = jobQueueConstants.find((item) => item.constant_name === 'JOB_QUEUE_ENABLED');
    const jobQueueConcurrency = jobQueueConstants.find((item) => item.constant_name === 'JOB_QUEUE_CONCURRENCY');
    const jobQueuePeriod = jobQueueConstants.find((item) => item.constant_name === 'JOB_QUEUE_PERIOD');
    const jobQueueAttempts = jobQueueConstants.find((item) => item.constant_name === 'JOB_QUEUE_ATTEMPTS');
    const jobQueueTimeout = jobQueueConstants.find((item) => item.constant_name === 'JOB_QUEUE_TIMEOUT');

    // Update the constants tracked by this queue scheduler
    this._enabled = jobQueueEnabled?.character_value === 'true' || QUEUE_DEFAULT_ENABLED;
    this._concurrency = Number(jobQueueConcurrency?.numeric_value) || QUEUE_DEFAULT_CONCURRENCY;
    this._period = Number(jobQueuePeriod?.numeric_value) || QUEUE_DEFAULT_PERIOD;
    this._attempts = Number(jobQueueAttempts?.numeric_value) || QUEUE_DEFAULT_ATTEMPTS;
    this._timeout = Number(jobQueueTimeout?.numeric_value) || QUEUE_DEFAULT_TIMEOUT;

    // Update the internal concurrency tracked by the queue
    this._queue.setJobQueueConcurrency(this._concurrency);
    // Update the internal timeout tracked by the queue
    this._queue.setJobTimeout(this._timeout);

    await connection.commit();
    connection.release();

    defaultLog.debug({
      label: 'updateJobQueueSettings',
      message: 'Current settings',
      enabled: this._enabled,
      concurrency: this._concurrency,
      period: this._period,
      attempts: this._attempts,
      timeout: this._timeout
    });
  }

  /**
   * If the queue is not full, fetch a batch of unprocessed queue records if any exist and kick off their
   * corresponding jobs.
   *
   * @memberof QueueScheduler
   */
  async _processJobQueueRecords() {
    if (this._readyToProcessAnotherRecord()) {
      const nextJobQueueRecords = await this._getUnprocessedJobQueueRecords();

      nextJobQueueRecords.forEach(async (jobQueueRecord) => {
        this._processJobQueueRecord(jobQueueRecord);
      });
    }
  }

  _readyToProcessAnotherRecord(): boolean {
    return this._enabled && this._queue.getJobQueueLength() === 0;
  }

  /**
   * Fetch a batch of unprocessed queue records, if any exist.
   *
   * @return {*}
   * @memberof QueueScheduler
   */
  async _getUnprocessedJobQueueRecords() {
    const connection = getAPIUserDBConnection();

    await connection.open();

    const jobQueueService = new SubmissionJobQueueService(connection);

    const nextJobQueueRecords = await jobQueueService.getNextUnprocessedJobQueueRecords(
      this._concurrency,
      this._attempts
    );

    await connection.commit();

    connection.release();

    return nextJobQueueRecords;
  }

  /**
   * Process a single queue record, kicking off its corresponding job.
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @memberof QueueScheduler
   */
  async _processJobQueueRecord(jobQueueRecord: ISubmissionJobQueueRecord) {
    const connection = getAPIUserDBConnection();

    await connection.open();

    const jobQueueService = new SubmissionJobQueueService(connection);

    // Initialize the job queue record by setting its start time.
    await jobQueueService.startQueueRecord(jobQueueRecord.submission_job_queue_id);

    await connection.commit();

    // On job success
    const onResolve = async (resolve: unknown) => {
      defaultLog.debug({
        label: 'processNextUnprocessedJobQueueRecord',
        message: 'onResolve',
        submission_job_queue_id: jobQueueRecord.submission_job_queue_id,
        resolve: resolve
      });

      // Mark a job queue record as complete by settings its end time.
      jobQueueService.endJobQueueRecord(jobQueueRecord.submission_job_queue_id);
      await connection.commit();
    };

    // On job failure
    const onReject = async (error: unknown) => {
      defaultLog.debug({
        label: 'processNextUnprocessedJobQueueRecord',
        message: 'onReject',
        submission_job_queue_id: jobQueueRecord.submission_job_queue_id,
        error: error
      });

      await connection.rollback();
      // Mark a job queue record as unprocessed by resetting its start and end times to null.
      jobQueueService.resetJobQueueRecord(jobQueueRecord.submission_job_queue_id);
      await connection.commit();
    };

    // On job complete (success or failure)
    const onComplete = async () => {
      defaultLog.debug({
        label: 'processNextUnprocessedJobQueueRecord',
        message: 'onComplete',
        submission_job_queue_id: jobQueueRecord.submission_job_queue_id
      });

      connection.release();
    };

    this._queue.addJobToQueue(jobQueueRecord).then(onResolve).catch(onReject).finally(onComplete);
  }
}
