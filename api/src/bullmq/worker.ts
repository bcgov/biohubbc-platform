import { Job, QueueEvents, Worker } from 'bullmq';
import { getAPIUserDBConnection } from '../database/db';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';
import { getLogger } from '../utils/logger';
import { queueConfig } from './config';
import { getJobHandler, SubmissionJobPayload } from './job-handlers';
import { redisOptions } from './redis-connection';

const defaultLog = getLogger('bullmq/worker');

const markJobAttempt = async (jobId: number) => {
  const connection = getAPIUserDBConnection();

  try {
    await connection.open();

    const jobQueueService = new SubmissionJobQueueService(connection);
    await jobQueueService.incrementAttemptCount(jobId);
    await jobQueueService.startQueueRecord(jobId);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markJobComplete = async (jobId: number) => {
  const connection = getAPIUserDBConnection();

  try {
    await connection.open();

    const jobQueueService = new SubmissionJobQueueService(connection);
    await jobQueueService.endJobQueueRecord(jobId);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const resetJobForRetry = async (jobId: number) => {
  const connection = getAPIUserDBConnection();

  try {
    await connection.open();

    const jobQueueService = new SubmissionJobQueueService(connection);
    await jobQueueService.resetJobQueueRecord(jobId);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    defaultLog.error({ label: 'resetJobForRetry', message: 'failed to reset queue record', error });
  } finally {
    connection.release();
  }
};

const processJob = async (job: Job<SubmissionJobPayload>) => {
  const attemptsAllowed = job.opts.attempts ?? queueConfig.jobAttempts;
  const jobId = job.data.submission_job_queue_id;

  await markJobAttempt(jobId);

  const handler = getJobHandler(job.data.jobType);

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise((_resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('job exceeded timeout')), queueConfig.jobTimeoutMs);
    });

    await Promise.race([handler(job), timeoutPromise]);

    await markJobComplete(jobId);
  } catch (error) {
    const attemptsMade = job.attemptsMade + 1; // attemptsMade is zero-based
    const isFinalAttempt = attemptsMade >= attemptsAllowed;

    if (isFinalAttempt) {
      await resetJobForRetry(jobId);
    }

    defaultLog.error({
      label: 'processJob',
      message: 'job failed',
      submission_job_queue_id: jobId,
      attemptsMade,
      attemptsAllowed,
      error
    });

    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

export const startWorker = () => {
  const worker = new Worker<SubmissionJobPayload>(queueConfig.queueName, processJob, {
    connection: redisOptions,
    concurrency: queueConfig.workerConcurrency
  });

  const events = new QueueEvents(queueConfig.queueName, { connection: redisOptions });

  worker.on('completed', (job: Job<SubmissionJobPayload>) => {
    defaultLog.info({
      label: 'completed',
      message: 'job complete',
      submission_job_queue_id: job.data.submission_job_queue_id,
      attemptsMade: job.attemptsMade
    });
  });

  worker.on('failed', (job: Job<SubmissionJobPayload> | undefined, err: Error) => {
    defaultLog.error({
      label: 'failed',
      message: 'job failed',
      submission_job_queue_id: job?.data.submission_job_queue_id,
      attemptsMade: job?.attemptsMade,
      err
    });
  });

  events.on('failed', async (event: { jobId: string; failedReason: string }) => {
    defaultLog.error({ label: 'events.failed', message: 'job failed event', event });
  });

  return { worker, events };
};
