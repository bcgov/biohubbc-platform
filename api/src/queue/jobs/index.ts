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
  COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED: 'compute-submission-feature-closure-failed',
  /**
   * Recurring scheduler tick that drives due download-schedule reruns. This is the infrastructure
   * cadence (a fixed interval); each schedule's own cron_expression is the per-download cadence.
   */
  POLL_DOWNLOAD_SCHEDULES: 'poll-download-schedules',
  /**
   * Dead letter queue for failed poll-download-schedules ticks.
   * Jobs are moved here after all retries are exhausted.
   */
  POLL_DOWNLOAD_SCHEDULES_FAILED: 'poll-download-schedules-failed',
  /**
   * Recurring sweep that deletes expired map tile contexts. Housekeeping only: expiry is enforced in
   * the tile SQL on every request, so a missed tick leaves no context authorizing tiles.
   */
  DELETE_EXPIRED_TILE_CONTEXTS: 'delete-expired-tile-contexts',
  /**
   * Dead letter queue for failed delete-expired-tile-contexts ticks.
   * Jobs are moved here after all retries are exhausted.
   */
  DELETE_EXPIRED_TILE_CONTEXTS_FAILED: 'delete-expired-tile-contexts-failed',
  /**
   * Submission upload security queue — automatic security screening. Evaluates active security
   * rules against a submission upload's features after closure has been populated and inserts
   * draft submission_feature_security records. Records its lifecycle in submission_upload_security.
   */
  SUBMISSION_UPLOAD_SECURITY: 'submission-upload-security',
  /**
   * Dead letter queue for failed submission-upload-security jobs.
   * Jobs are moved here after all retries are exhausted.
   */
  SUBMISSION_UPLOAD_SECURITY_FAILED: 'submission-upload-security-failed'
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];
