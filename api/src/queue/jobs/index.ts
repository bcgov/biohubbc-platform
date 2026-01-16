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
  PROCESS_SUBMISSION_FEATURES: 'process-submission-features',
  /**
   * Dead letter queue for failed process-submission-features jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  PROCESS_SUBMISSION_FEATURES_FAILED: 'process-submission-features-failed'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
