import { IDBConnection } from '../database/db';
import { DownloadStatusEnum } from '../models/download-status';
import { SubmissionUpload } from '../models/submission-upload';
import { DownloadService } from '../services/download/download-service';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IComputeScopeAnchorsJobData } from './jobs/compute-scope-anchors-job';
import { IIndexSubmissionFeaturesJobData } from './jobs/index-submission-features-job';
import { IMalwareScanJobData } from './jobs/malware-scan-job';
import { IProcessDownloadJobData } from './jobs/process-download-job';
import { getPgBoss } from './pg-boss-service';

const defaultLog = getLogger('queue/publisher');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 *
 * Testing convention: for publisher behavior, prefer stubbing this bag so all
 * queue-publish entry points use a single seam.
 */
export interface PublisherDependencies {
  getPgBoss: typeof getPgBoss;
  createSubmissionValidationService: (connection: IDBConnection) => SubmissionValidationService;
  createDownloadService: (connection: IDBConnection) => DownloadService;
}

export const publisherDependencies: PublisherDependencies = {
  getPgBoss,
  createSubmissionValidationService: (connection: IDBConnection) => new SubmissionValidationService(connection),
  createDownloadService: (connection: IDBConnection) => new DownloadService(connection)
};

/**
 * Options for publishing a job.
 */
export interface IPublishOptions {
  /** Number of retry attempts on failure (default: 2) */
  retryLimit?: number;
  /** Delay in seconds between retries (default: 60) */
  retryDelay?: number;
  /** Use exponential backoff for retries (default: true) */
  retryBackoff?: boolean;
  /** Job expiration time in seconds (default: 3600 = 1 hour) */
  expireInSeconds?: number;
  /** Delay job start until this date/time */
  startAfter?: Date | string;
  /** Unique key to prevent duplicate jobs */
  singletonKey?: string;
  /** Job priority (higher = processed first) */
  priority?: number;
}

/**
 * Result of publishing a job.
 * Discriminated union allows caller to handle different outcomes.
 */
export type PublishJobResult =
  | { status: 'published'; jobId: string }
  | { status: 'blocked'; message: string; existingStatus: string }
  | { status: 'duplicate'; message: string }
  | { status: 'error'; message: string };

/**
 * Options for process submission features jobs.
 *
 * Singleton key is per-submission
 * pg-boss won't dequeue a new job for the same singleton key while the current one is active.
 */
const PROCESS_SUBMISSION_FEATURES_OPTIONS: IPublishOptions = {
  retryLimit: 2,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 10 // 10 minutes
};

/**
 * Options for malware scan jobs.
 * Scans can take longer for large tarballs.
 */
const MALWARE_SCAN_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 // 60 minutes
};

/**
 * Options for process download jobs.
 * Generous timeout — large downloads stream millions of rows via cursor and may take significant time.
 * Includes S3 upload which may have transient failures.
 */
const PROCESS_DOWNLOAD_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 * 4 // 4 hours
};

/**
 * Publish a process submission features job to the queue.
 *
 * Queues slow operations (indexing, regions) for submission feature processing.
 * Also creates a submission_validation record for tracking.
 *
 * Blocks if an existing validation record exists unless status is 'failed',
 * which allows retrying failed jobs.
 *
 * Caller provides the pre-resolved submission_upload bridge record — avoids
 * redundant lookups since the caller (ArtifactSecurityService) already has it.
 * Singleton key is per-submission (not per-upload) to prevent concurrent jobs for the
 * same submission — two uploads must serialize to avoid conflicting feature writes.
 *
 * @param {IDBConnection} connection Database connection for submission validation tracking
 * @param {SubmissionUpload} submissionUpload Pre-resolved bridge record
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, blocked, duplicate, or error
 */
export const publishProcessSubmissionFeaturesJob = async (
  connection: IDBConnection,
  submissionUpload: SubmissionUpload,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

  try {
    const submissionValidationService = publisherDependencies.createSubmissionValidationService(connection);

    // Check for existing validation record by submission_upload_id
    const existingValidation = await submissionValidationService.getSubmissionValidationBySubmissionUploadId(
      submissionUploadId
    );

    if (existingValidation) {
      // Only allow retry if status is 'failed' or 'invalid'
      if (existingValidation.status !== 'failed' && existingValidation.status !== 'invalid') {
        defaultLog.warn({
          label: 'publishProcessSubmissionFeaturesJob',
          message: 'Blocked: validation record already exists',
          submissionUploadId,
          existingStatus: existingValidation.status,
          existingJobId: existingValidation.job_id
        });

        return {
          status: 'blocked',
          message: `Validation already exists with status '${existingValidation.status}'`,
          existingStatus: existingValidation.status
        };
      }

      defaultLog.info({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Retrying failed validation',
        submissionUploadId,
        previousJobId: existingValidation.job_id
      });
    }

    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...PROCESS_SUBMISSION_FEATURES_OPTIONS, ...options };

    // Ensure queue exists before sending jobs
    await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES);

    const db = {
      executeSql: async (text: string, values: any[]) => {
        const result = await connection.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      }
    };

    // Full bridge record travels through the queue — handler uses it directly
    const jobData: SubmissionUpload = submissionUpload;

    // Use singletonKey to prevent duplicate concurrent jobs for the same submission
    const jobId = await boss.send(JobQueues.PROCESS_SUBMISSION_FEATURES, jobData, {
      ...mergedOptions,
      singletonKey: `submission-${submissionId}`,
      db
    });

    // jobId is null when pg-boss rejects the job (e.g., duplicate singletonKey still active)
    if (jobId) {
      // Create submission validation record for tracking
      await submissionValidationService.createSubmissionValidation(submissionUploadId, submissionId, jobId);

      defaultLog.info({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Process submission features job published',
        jobId,
        submissionUploadId
      });

      return { status: 'published', jobId };
    } else {
      defaultLog.warn({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Job not published (duplicate or throttled)',
        submissionUploadId
      });

      return { status: 'duplicate', message: 'Job already exists for this submission' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishProcessSubmissionFeaturesJob',
      message: 'Failed to publish job',
      submissionUploadId,
      error
    });

    return { status: 'error', message: errorMessage };
  }
};

/**
 * Publish a malware scan job to the queue.
 *
 * Queues ClamAV scanning for an uploaded artifact.
 *
 * @param {IDBConnection} connection Database connection for submission validation tracking
 * @param {IMalwareScanJobData} data Job data containing artifactSecurityId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, duplicate, or error
 */
export const publishMalwareScanJob = async (
  connection: IDBConnection,
  data: IMalwareScanJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...MALWARE_SCAN_OPTIONS, ...options };

    await boss.createQueue(JobQueues.MALWARE_SCAN);

    const db = {
      executeSql: async (text: string, values: any[]) => {
        const result = await connection.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      }
    };

    // Use singletonKey to prevent duplicate concurrent jobs for the same artifact security record
    const jobId = await boss.send(JobQueues.MALWARE_SCAN, data, {
      ...mergedOptions,
      singletonKey: `artifact-security-${data.artifactSecurityId}`,
      db
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishMalwareScanJob',
        message: 'Malware scan job published',
        jobId,
        artifactSecurityId: data.artifactSecurityId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishMalwareScanJob',
      message: 'Job not published (duplicate or throttled)',
      artifactSecurityId: data.artifactSecurityId
    });

    return { status: 'duplicate', message: 'Job already exists for this artifact security record' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishMalwareScanJob',
      message: 'Failed to publish job',
      artifactSecurityId: data.artifactSecurityId,
      error
    });

    return { status: 'error', message: errorMessage };
  }
};

/**
 * Publish a process download job to the queue.
 *
 * Queues async packaging of selected features into a downloadable zip file.
 * Updates the download record with the job_id for tracking.
 *
 * @param {IDBConnection} connection Database connection for download record updates
 * @param {IProcessDownloadJobData} data Job data containing downloadId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, duplicate, or error
 */
export const publishProcessDownloadJob = async (
  connection: IDBConnection,
  data: IProcessDownloadJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const downloadService = publisherDependencies.createDownloadService(connection);

    // Check if download exists
    const download = await downloadService.findDownloadById(data.downloadId);

    if (!download) {
      return { status: 'error', message: 'Download not found' };
    }

    // Check if download is already being processed or completed
    if (download.download_status !== DownloadStatusEnum.PENDING) {
      defaultLog.warn({
        label: 'publishProcessDownloadJob',
        message: 'Download is not in pending status',
        downloadId: data.downloadId,
        currentStatus: download.download_status
      });

      return { status: 'duplicate', message: 'Job already exists for this download' };
    }

    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...PROCESS_DOWNLOAD_OPTIONS, ...options };

    await boss.createQueue(JobQueues.PROCESS_DOWNLOAD);

    // Insert the job in the same transaction as the business data via the `db` option.
    // This prevents ghost jobs (job exists but data rolled back) and lost jobs (data committed but job never sent).
    const db = {
      executeSql: async (text: string, values: any[]) => {
        const result = await connection.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      }
    };

    // Use singletonKey to prevent duplicate concurrent jobs for the same download
    const jobId = await boss.send(JobQueues.PROCESS_DOWNLOAD, data, {
      ...mergedOptions,
      singletonKey: `download-${data.downloadId}`,
      db
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishProcessDownloadJob',
        message: 'Process download job published',
        jobId,
        downloadId: data.downloadId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishProcessDownloadJob',
      message: 'Job not published (duplicate or throttled)',
      downloadId: data.downloadId
    });

    return { status: 'duplicate', message: 'Job already exists for this download' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishProcessDownloadJob',
      message: 'Failed to publish job',
      downloadId: data.downloadId,
      error
    });

    return { status: 'error', message: errorMessage };
  }
};

/**
 * Options for index submission features jobs.
 * Same timeout as validation — indexing should complete within minutes.
 */
const INDEX_SUBMISSION_FEATURES_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 10 // 10 minutes
};

/**
 * Publish an index submission features job to the queue.
 *
 * Queues async deep property indexing/validation for a submission upload. Uses the caller's
 * DB connection via pg-boss's `db` option so the job insert participates in
 * the same transaction — if the caller rolls back, the job is never visible.
 *
 * @param {IDBConnection} connection Database connection for transactional job insert
 * @param {IIndexSubmissionFeaturesJobData} data Job data containing submissionId and submissionUploadId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, duplicate, or error
 */
export const publishIndexSubmissionFeaturesJob = async (
  connection: IDBConnection,
  data: IIndexSubmissionFeaturesJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...INDEX_SUBMISSION_FEATURES_OPTIONS, ...options };

    await boss.createQueue(JobQueues.INDEX_SUBMISSION_FEATURES);

    // Use singletonKey to prevent duplicate concurrent indexing jobs for the same submission
    // Pass caller's connection via db option so job insert is part of the same transaction
    const jobId = await boss.send(JobQueues.INDEX_SUBMISSION_FEATURES, data, {
      ...mergedOptions,
      singletonKey: `submission-idx-${data.submissionId}`,
      db: { executeSql: (text: string, values: any[]) => connection.query(text, values) }
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishIndexSubmissionFeaturesJob',
        message: 'Index submission features job published',
        jobId,
        submissionId: data.submissionId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishIndexSubmissionFeaturesJob',
      message: 'Job not published (duplicate or throttled)',
      submissionId: data.submissionId
    });

    return { status: 'duplicate', message: 'Job already exists for this submission' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishIndexSubmissionFeaturesJob',
      message: 'Failed to publish job',
      submissionId: data.submissionId,
      error
    });

    return { status: 'error', message: errorMessage };
  }
};

/**
 * Options for compute scope anchors jobs.
 * Anchor computation is a single SQL INSERT ... SELECT — typically completes in seconds.
 * Retry with backoff handles transient lock contention on high-write tables.
 */
const COMPUTE_SCOPE_ANCHORS_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 30 // 30 minutes
};

/**
 * Publish a compute scope anchors job to the queue.
 *
 * Queues async anchor computation for a security scope. Each scope gets its
 * own job — different scopes can compute concurrently. No singleton key is
 * needed because anchor computation is idempotent (ON CONFLICT DO NOTHING).
 *
 * @param {IDBConnection} connection Database connection for transactional job insert
 * @param {IComputeScopeAnchorsJobData} data Job data containing securityScopeId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, duplicate, or error
 */
export const publishComputeScopeAnchorsJob = async (
  connection: IDBConnection,
  data: IComputeScopeAnchorsJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...COMPUTE_SCOPE_ANCHORS_OPTIONS, ...options };

    await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS);

    // Global singleton key — only one anchor computation job runs at a time.
    // Anchor computation does keyset-paginated scans of submission_feature (100M+ rows).
    // Without serialization, N concurrent jobs = N concurrent full-table scans.
    // Queued jobs wait until the active one completes, then run in order.
    const jobId = await boss.send(JobQueues.COMPUTE_SCOPE_ANCHORS, data, {
      ...mergedOptions,
      singletonKey: 'scope-anchors',
      db: { executeSql: (text: string, values: any[]) => connection.query(text, values) }
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishComputeScopeAnchorsJob',
        message: 'Compute scope anchors job published',
        jobId,
        securityScopeId: data.securityScopeId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishComputeScopeAnchorsJob',
      message: 'Job not published (duplicate or throttled)',
      securityScopeId: data.securityScopeId
    });

    return { status: 'duplicate', message: 'Job already exists for this security scope' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishComputeScopeAnchorsJob',
      message: 'Failed to publish job',
      securityScopeId: data.securityScopeId,
      error
    });

    return { status: 'error', message: errorMessage };
  }
};
