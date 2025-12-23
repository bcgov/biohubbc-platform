/**
 * Job queue names.
 *
 * Each queue name maps to a registered job handler.
 */
export const JobQueues = {
  /**
   * Example job queue for demonstration purposes.
   * Replace with actual job queues as needed.
   */
  EXAMPLE: 'example'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
