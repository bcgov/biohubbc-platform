import { Queue } from 'bullmq';
import { redisOptions } from '../bullmq/redis-connection';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('services/virus-scan-queue-service');

export const VIRUS_SCAN_QUEUE_NAME = process.env.VIRUS_SCAN_QUEUE_NAME || 'virus-scan';
export const VIRUS_SCAN_JOB_NAME = 'virus-scan';

export interface IVirusScanJob {
  fileKey: string;
  bucket?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
}

export interface IVirusScanJobResult {
  jobId: string;
  queue: string;
}

type QueueFactory = () => Queue;

/**
 * Lazily create and reuse the BullMQ queue connection.
 */
const defaultQueueFactory: QueueFactory = (() => {
  let queue: Queue | null = null;

  return () => {
    if (!queue) {
      queue = new Queue(VIRUS_SCAN_QUEUE_NAME, { connection: redisOptions });
    }

    return queue;
  };
})();

export class VirusScanQueueService {
  constructor(private queueFactory: QueueFactory = defaultQueueFactory) {}

  async enqueue(job: IVirusScanJob): Promise<IVirusScanJobResult> {
    try {
      const queue = this.queueFactory();

      const queuedJob = await queue.add(VIRUS_SCAN_JOB_NAME, job, {
        removeOnComplete: { age: 60 * 60 * 24, count: 500 },
        removeOnFail: false
      });

      return { jobId: String(queuedJob.id), queue: VIRUS_SCAN_QUEUE_NAME };
    } catch (error) {
      defaultLog.error({ label: 'enqueue', message: 'failed to enqueue virus scan job', job, error });
      throw error;
    }
  }
}
