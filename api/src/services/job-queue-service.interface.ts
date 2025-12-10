export type JobState = 'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | 'paused' | 'unknown';

export interface EnqueueJobOptions {
  jobId?: string;
  priority?: number;
  delayMs?: number;
  attempts?: number;
  timeoutMs?: number;
  backoff?: number | { type: 'fixed' | 'exponential'; delay: number };
  removeOnComplete?: boolean | { age?: number; count?: number };
  removeOnFail?: boolean | { age?: number; count?: number };
  lifo?: boolean;
  providerOptions?: Record<string, unknown>;
}

export interface JobDetails<TData = unknown> {
  id: string;
  name: string;
  queue: string;
  state: JobState;
  payload: TData;
  attemptsMade: number;
  maxAttempts?: number;
  timestamp?: number;
  processedOn?: number | null;
  finishedOn?: number | null;
  failedReason?: string | null;
  result?: unknown;
  progress?: number | object | null;
}

export interface QueueSummary {
  name: string;
  jobCounts?: Record<string, number>;
}

export interface IJobQueueService<TData = unknown> {
  enqueueJob(
    queueName: string,
    jobName: string,
    payload: TData,
    options?: EnqueueJobOptions
  ): Promise<JobDetails<TData>>;

  abortJob(queueName: string, jobId: string): Promise<boolean>;

  getQueueJobStatuses(queueName: string): Promise<JobDetails<TData>[]>;

  getJobStatus(queueName: string, jobId: string): Promise<JobDetails<TData> | null>;

  listQueues(): Promise<QueueSummary[]>;
}
