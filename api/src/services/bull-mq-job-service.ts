import { Job, JobsOptions, Queue, JobType } from 'bullmq';
import { redisOptions } from '../bullmq/redis-connection';
import { getLogger } from '../utils/logger';
import {
  EnqueueJobOptions,
  IJobQueueService,
  JobDetails,
  JobState,
  QueueSummary
} from './job-queue-service.interface';

type QueueFactory = (queueName: string) => Queue;

interface BullMQJobServiceOptions {
  queueFactory?: QueueFactory;
  knownQueues?: string[];
}

const defaultQueueFactory: QueueFactory = (queueName: string) => new Queue(queueName, { connection: redisOptions });
const jobTypesForStatus: Array<JobType> = ['waiting', 'waiting-children', 'active', 'delayed', 'completed', 'failed', 'paused'];
const jobStateFallback: JobState = 'unknown';

const defaultLog = getLogger('services/bullmq-job-service');

export class BullMQJobService implements IJobQueueService {
  private readonly queueFactory: QueueFactory;
  private readonly queues = new Map<string, Queue>();
  private readonly knownQueues = new Set<string>();

  constructor(options: BullMQJobServiceOptions = {}) {
    this.queueFactory = options.queueFactory ?? defaultQueueFactory;
    options.knownQueues?.forEach((name) => this.knownQueues.add(name));
  }

  private getQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);

    if (!queue) {
      queue = this.queueFactory(queueName);
      this.queues.set(queueName, queue);
    }

    this.knownQueues.add(queueName);

    return queue;
  }

  async enqueueJob<TData = unknown>(
    queueName: string,
    jobName: string,
    payload: TData,
    options?: EnqueueJobOptions
  ): Promise<JobDetails<TData>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, payload, this.buildJobsOptions(options));

    return this.mapJob(queueName, job);
  }

  async abortJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    if (state === 'active') {
      // TODO: must be scoped to instance if we are in a single queue setup.
      await job.moveToFailed(new Error('Job aborted by request'), 'temporaryToken', true);
    } else {
      await queue.remove(jobId);
    }

    return true;
  }

  async getQueueJobStatuses(queueName: string): Promise<JobDetails[]> {
    const queue = this.getQueue(queueName);
    const jobs = await queue.getJobs(jobTypesForStatus, 0, -1, true); //fix

    return Promise.all(jobs.map((job) => this.mapJob(queueName, job)));
  }

  async getJobStatus(queueName: string, jobId: string): Promise<JobDetails | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    return this.mapJob(queueName, job);
  }

  async listQueues(): Promise<QueueSummary[]> {
    const queueNames = Array.from(this.knownQueues);

    const summaries = await Promise.all(
      queueNames.map(async (name) => {
        const queue = this.getQueue(name);
        const jobCounts = await queue.getJobCounts(
          'waiting',
          'waiting-children',
          'active',
          'delayed',
          'completed',
          'failed',
          'paused'
        );

        return { name, jobCounts };
      })
    );

    return summaries;
  }

  async close(): Promise<void> {
    const queues = Array.from(this.queues.values());
    await Promise.allSettled(queues.map((queue) => queue.close()));
    this.queues.clear();
  }

  private async mapJob<TData = unknown>(queueName: string, job: Job<TData>): Promise<JobDetails<TData>> {
    let state: JobState = jobStateFallback;

    try {
      state = ((await job.getState()) as JobState) ?? jobStateFallback;
    } catch (error) {
      defaultLog.warn({ label: 'mapJob', message: 'failed to read job state', queueName, jobId: job.id, error });
    }

    return {
      id: String(job.id),
      name: job.name,
      queue: queueName,
      state,
      payload: job.data,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      failedReason: job.failedReason ?? null,
      result: job.returnvalue,
      progress: (job.progress as number | object | undefined) ?? null
    };
  }

  private buildJobsOptions(options?: EnqueueJobOptions): JobsOptions | undefined {
    if (!options) {
      return undefined;
    }

    const jobsOptions: JobsOptions = {};

    if (options.jobId) {
      jobsOptions.jobId = options.jobId;
    }

    if (typeof options.priority === 'number') {
      jobsOptions.priority = options.priority;
    }

    if (typeof options.delayMs === 'number') {
      jobsOptions.delay = options.delayMs;
    }

    if (typeof options.timeoutMs === 'number') {
      // do nothing, BullMQ does not support per-job timeouts
    }

    if (typeof options.attempts === 'number') {
      jobsOptions.attempts = options.attempts;
    }

    if (options.backoff !== undefined) {
      jobsOptions.backoff = options.backoff;
    }

    if (options.removeOnComplete !== undefined) {
      jobsOptions.removeOnComplete = options.removeOnComplete;
    }

    if (options.removeOnFail !== undefined) {
      jobsOptions.removeOnFail = options.removeOnFail;
    }

    if (typeof options.lifo === 'boolean') {
      jobsOptions.lifo = options.lifo;
    }

    if (options.providerOptions) {
      Object.assign(jobsOptions, options.providerOptions);
    }

    return jobsOptions;
  }
}
