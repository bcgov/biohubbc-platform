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
  MALWARE_SCAN_FAILED: 'malware-scan-failed',
  /**
   * Process download job queue for async download packaging.
   */
  PROCESS_DOWNLOAD: 'process-download',
  /**
   * Dead letter queue for failed download jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  PROCESS_DOWNLOAD_FAILED: 'process-download-failed',
  /**
   * Process download export job queue for async CSV export packaging over an
   * already-ready download's per-feature-type Parquet artifacts.
   */
  PROCESS_DOWNLOAD_EXPORT: 'process-download-export',
  /**
   * Dead letter queue for failed download export jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  PROCESS_DOWNLOAD_EXPORT_FAILED: 'process-download-export-failed',
  /**
   * Process download version export job queue for async CSV export packaging keyed on the shared
   * artifact group — one packaging run per group, regardless of how many user exports attach to it.
   */
  PROCESS_DOWNLOAD_VERSION_EXPORT: 'process-download-version-export',
  /**
   * Dead letter queue for failed download version export jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED: 'process-download-version-export-failed',
  /**
   * Index submission features job queue for async search indexing after validation.
   */
  INDEX_SUBMISSION_FEATURES: 'index-submission-features',
  /**
   * Dead letter queue for failed index-submission-features jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  INDEX_SUBMISSION_FEATURES_FAILED: 'index-submission-features-failed',
  /**
   * Compute scope anchors queue for async anchor computation after scope creation.
   */
  COMPUTE_SCOPE_ANCHORS: 'compute-scope-anchors',
  /**
   * Dead letter queue for failed compute-scope-anchors jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  COMPUTE_SCOPE_ANCHORS_FAILED: 'compute-scope-anchors-failed',
  /**
   * Compute submission feature closure queue for async reachability recomputation after indexing.
   */
  COMPUTE_SUBMISSION_FEATURE_CLOSURE: 'compute-submission-feature-closure',
  /**
   * Dead letter queue for failed compute-submission-feature-closure jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED: 'compute-submission-feature-closure-failed'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
