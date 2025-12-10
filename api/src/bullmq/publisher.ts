import { getAPIUserDBConnection } from '../database/db';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';
import { IJobQueueService } from '../services/job-queue-service.interface';
import { getLogger } from '../utils/logger';
import { queueConfig } from './config';

const defaultLog = getLogger('bullmq/publisher');

export class RedisQueuePublisher {
  private isRunning = false;

  constructor(private readonly jobQueueService: IJobQueueService, private readonly queueName: string) {}

  start(): void {
    const tick = async () => {
      if (this.isRunning) {
        return;
      }

      this.isRunning = true;

      try {
        await this.syncPendingJobs();
      } catch (error) {
        defaultLog.error({ label: 'syncPendingJobs', message: 'error syncing pending jobs', error });
      } finally {
        this.isRunning = false;
        setTimeout(tick, queueConfig.syncIntervalMs);
      }
    };

    void tick();
  }

  async syncPendingJobs(): Promise<number> {
    const connection = getAPIUserDBConnection();
    let queued = 0;

    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);
      const pendingRecords = await jobQueueService.getNextUnprocessedJobQueueRecords(
        queueConfig.workerConcurrency,
        queueConfig.jobAttempts,
        queueConfig.jobTimeoutMs
      );

      await connection.commit();

      for (const record of pendingRecords) {
        try {
          await this.enqueue(record);
          queued++;
        } catch (error) {
          defaultLog.error({ label: 'syncPendingJobs', message: 'failed to enqueue job', record, error });
        }
      }
    } catch (error) {
      defaultLog.error({ label: 'syncPendingJobs', message: 'error fetching pending jobs', error });
      await connection.rollback();
    } finally {
      connection.release();
    }

    return queued;
  }

  private async enqueue(record: ISubmissionJobQueueRecord) {
    await this.markJobQueued(record.submission_job_queue_id);

    try {
      const jobName = 'submission-job';

      await this.jobQueueService.enqueueJob(
        this.queueName,
        jobName,
        { ...record, jobType: jobName },
        {
          attempts: queueConfig.jobAttempts,
          backoff: { type: 'exponential', delay: queueConfig.jobBackoffMs },
          removeOnComplete: { age: 60 * 60 * 24, count: 500 },
          removeOnFail: false
        }
      );
    } catch (error) {
      defaultLog.error({ label: 'enqueue', message: 'failed to push job to redis, resetting', error });
      await this.resetQueuedJob(record.submission_job_queue_id);
      throw error;
    }
  }

  private async markJobQueued(jobId: number) {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);
      await jobQueueService.startQueueRecord(jobId);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async resetQueuedJob(jobId: number) {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const jobQueueService = new SubmissionJobQueueService(connection);
      await jobQueueService.resetJobQueueRecord(jobId);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      defaultLog.error({ label: 'resetQueuedJob', message: 'error resetting queued job', error });
    } finally {
      connection.release();
    }
  }
}
