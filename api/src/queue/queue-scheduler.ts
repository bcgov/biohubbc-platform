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
  /**
   * Is the queue scheduler enabled, and processing jobs.
   *
   * @memberof QueueScheduler
   */
  _enabled = QUEUE_DEFAULT_ENABLED;
  /**
   * How many jobs can be executed in parallel.
   *
   * @memberof QueueScheduler
   */
  _concurrency = QUEUE_DEFAULT_CONCURRENCY;
  /**
   * How often the queue scheduler checks for new jobs.
   *
   * @memberof QueueScheduler
   */
  _period = QUEUE_DEFAULT_PERIOD;
  /**
   * The maximum number of times a job will be attempted, if it fails to resolve successfully, before abandoning it.
   *
   * @memberof QueueScheduler
   */
  _attempts = QUEUE_DEFAULT_ATTEMPTS;
  /**
   * The maximum time a job can run before it is considered timed out and automatically rejected.
   *
   * @memberof QueueScheduler
   */
  _timeout = QUEUE_DEFAULT_TIMEOUT;

  _queue: Queue;

  /**
   * Creates an instance of QueueScheduler.
   *
   * @memberof QueueScheduler
   */
  constructor() {
    this._queue = new Queue();
  }

  /**
   * Start the scheduler process loop.
   *
   * @memberof QueueScheduler
   */
  async start() {
    // Check for updated queue settings
    await this._updateJobQueueSettings();

    // Process a round of jobs, if any unprocessed queue records exists
    this._processJobQueueRecords();

    // Wait for a period of time before looping
    setTimeout(() => this.start(), this._period);
  }

  /**
   * Fetch and apply any queue related settings.
   *
   * @return {*}  {Promise<void>}
   * @memberof QueueScheduler
   */
  async _updateJobQueueSettings(): Promise<void> {
    const connection = getAPIUserDBConnection();
    try {
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
    } catch (error) {
      defaultLog.error({ label: '_updateJobQueueSettings', message: 'error', error });
    } finally {
      await connection.commit();
      connection.release();
    }

    defaultLog.silly({
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

  /**
   * Whether or not the queue scheduler is ready to process additional jobs.
   *
   * @return {*}  {boolean} `true` if the queue scheduler can process additional jobs, `false` otherwise.
   * @memberof QueueScheduler
   */
  _readyToProcessAnotherRecord(): boolean {
    // If the queue scheduler is enabled and if the queue has not reached maximum concurrency
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

    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);
      // Fetch the next batch of unprocessed job queue records
      const nextJobQueueRecords = await jobQueueService.getNextUnprocessedJobQueueRecords(
        this._concurrency,
        this._attempts,
        this._timeout
      );

      await connection.commit();

      return nextJobQueueRecords;
    } catch (error) {
      defaultLog.error({ label: '_getUnprocessedJobQueueRecords', message: 'error', error });
      await connection.rollback();
    } finally {
      connection.release();
    }

    return [];
  }

  /**
   * Process a single queue record, kicking off its corresponding job.
   *
   * @param {ISubmissionJobQueueRecord} jobQueueRecord
   * @memberof QueueScheduler
   */
  async _processJobQueueRecord(jobQueueRecord: ISubmissionJobQueueRecord) {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);

      // Initialize the job queue record by setting its start time.
      await jobQueueService.startQueueRecord(jobQueueRecord.submission_job_queue_id);

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: '_processJobQueueRecord', message: 'start error', error });
      await connection.rollback();

      // Failed to update start time, return early
      return;
    } finally {
      connection.release();
    }

    // On job success
    const onResolve = async function (resolve: unknown) {
      const connection = getAPIUserDBConnection();

      try {
        await connection.open();

        const jobQueueService = new SubmissionJobQueueService(connection);
        // Mark a job queue record as complete by settings its end time.
        jobQueueService.endJobQueueRecord(jobQueueRecord.submission_job_queue_id);

        await connection.commit();
      } catch (error) {
        defaultLog.error({ label: '_processJobQueueRecord', message: 'onResolve error', error });
        await connection.rollback();
      } finally {
        connection.release();
      }

      defaultLog.debug({
        label: '_processJobQueueRecord',
        message: 'onResolve',
        submission_job_queue_id: jobQueueRecord.submission_job_queue_id,
        resolve: resolve
      });
    };

    // On job failure
    const onReject = async function (error: unknown) {
      const connection = getAPIUserDBConnection();

      try {
        await connection.open();

        const jobQueueService = new SubmissionJobQueueService(connection);
        // Mark a job queue record as unprocessed by resetting its start and end times to null.
        jobQueueService.resetJobQueueRecord(jobQueueRecord.submission_job_queue_id);

        await connection.commit();
      } catch (error) {
        defaultLog.error({ label: '_processJobQueueRecord', message: 'onReject error', error });
        await connection.rollback();
      } finally {
        connection.release();
      }

      defaultLog.error({
        label: '_processJobQueueRecord',
        message: 'onReject',
        submission_job_queue_id: jobQueueRecord.submission_job_queue_id,
        error
      });
    };

    this._queue.addJobToQueue(jobQueueRecord).then(onResolve, onReject).catch(onReject);
  }
}
