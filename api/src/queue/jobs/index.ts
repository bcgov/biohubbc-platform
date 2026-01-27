/**
 * Job queue names.
 *
 * Each queue name maps to a registered job handler.
 */
export const JobQueues = {
  /**
   * Process submission features job queue for async feature processing.
   */
  PROCESS_SUBMISSION_FEATURES: 'process-submission-features',
  /**
   * Dead letter queue for failed process-submission-features jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  PROCESS_SUBMISSION_FEATURES_FAILED: 'process-submission-features-failed',
  /**
   * Malware scan queue for uploaded artifacts awaiting security scans.
   */
  MALWARE_SCAN: 'malware-scan',
  /**
   * Dead letter queue for failed malware jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  MALWARE_SCAN_FAILED: 'malware-scan-failed'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
