import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IExampleJobData } from './jobs/example-job';
import { getPgBoss } from './pg-boss-service';

const defaultLog = getLogger('queue/publisher');

/**
 * Options for publishing a job.
 */
export interface IPublishOptions {
  /** Number of retry attempts on failure (default: 2) */
  retryLimit?: number;
  /** Delay in seconds between retries (default: 60) */
  retryDelay?: number;
  /** Job expiration time in seconds (default: 3600 = 1 hour) */
  expireInSeconds?: number;
  /** Delay job start until this date/time */
  startAfter?: Date | string;
  /** Unique key to prevent duplicate jobs */
  singletonKey?: string;
  /** Job priority (higher = processed first) */
  priority?: number;
}

const DEFAULT_OPTIONS: IPublishOptions = {
  retryLimit: 2,
  retryDelay: 60,
  expireInSeconds: 60 * 60 // 1 hour
};

/**
 * Publish an example job to the queue.
 *
 * This is a template demonstrating the pattern for publishing jobs.
 * Create similar functions for each job type.
 *
 * @param {IExampleJobData} data Job data
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {(Promise<string | null>)} Job ID if successful, null otherwise
 */
export const publishExampleJob = async (
  data: IExampleJobData,
  options: IPublishOptions = {}
): Promise<string | null> => {
  const boss = getPgBoss();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const jobId = await boss.send(JobQueues.EXAMPLE, data, mergedOptions);

  defaultLog.info({
    label: 'publishExampleJob',
    message: 'Job published',
    jobId,
    data
  });

  return jobId;
};
