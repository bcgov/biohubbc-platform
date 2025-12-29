/**
 * Job queue names.
 *
 * Each queue name maps to a registered job handler.
 */
export const JobQueues = {
  /**
   * Test job queue for demonstration purposes.
   */
  TEST: 'test',
  /**
   * Process submission features job queue for async feature processing.
   */
  PROCESS_SUBMISSION_FEATURES: 'process-submission-features'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
