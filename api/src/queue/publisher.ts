import { PROCESS_START_STATUSES, TERMINAL_UPLOAD_STATUSES } from '../constants/submission-upload';
import { IDBConnection } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import { DownloadStatusEnum } from '../models/download-status';
import { SubmissionUpload } from '../models/submission-upload';
import { DownloadService } from '../services/download/download-service';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IComputeScopeAnchorsJobData } from './jobs/compute-scope-anchors-job';
import { IComputeSubmissionFeatureClosureJobData } from './jobs/compute-submission-feature-closure-job';
import { IIndexSubmissionFeaturesJobData } from './jobs/index-submission-features-job';
import { IMalwareScanJobData } from './jobs/malware-scan-job';
import { IProcessDownloadExportJobData } from './jobs/process-download-export-job';
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
  | { status: 'duplicate'; message: string };

/**
 * Options for process submission features jobs.
 *
 * Singleton key is per-submission-upload.
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
 * Options for process download export jobs.
 *
 * Shorter budget than `PROCESS_DOWNLOAD` because exports read already-finalized
 * Parquet artifacts (the expensive feature-gathering work is done) — the
 * bounded work is read-one-row-group / write-one-CSV-chunk / upload-one-zip
 * per feature type, sequentially.
 */
const PROCESS_DOWNLOAD_EXPORT_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 // 1 hour
};

/**
 * Job data for the version-export packaging worker (Phase 5).
 *
 * Keyed on the shared artifact group rather than a per-user export: N user requests for the same
 * export shape resolve onto one group, and the worker packages that group exactly once.
 */
export interface IProcessDownloadVersionExportJobData {
  /** The download_version_export_artifact_group ID to package. */
  downloadVersionExportArtifactGroupId: string;
}

/**
 * Options for process download version export jobs.
 *
 * Identical budget to `PROCESS_DOWNLOAD_EXPORT` — exports read already-finalized Parquet artifacts
 * (the expensive feature-gathering work is done) and the bounded work is read-one-row-group /
 * write-one-CSV-chunk / upload-one-zip per feature type, sequentially.
 */
const PROCESS_DOWNLOAD_VERSION_EXPORT_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 // 1 hour
};

/**
 * Publish a process submission features job to the queue.
 *
 * Queues slow operations (indexing, regions) for submission feature processing.
 * Also creates a submission_validation record for tracking.
 *
 * Blocks if the upload lifecycle is terminal or an active validation record exists.
 *
 * Caller provides the pre-resolved submission_upload bridge record — avoids
 * redundant lookups since the caller (ArtifactSecurityService) already has it.
 * Singleton key is per-submission-upload to keep queue identity aligned with the
 * upload lifecycle row and validation record.
 *
 * @param {IDBConnection} connection Database connection for submission validation tracking
 * @param {SubmissionUpload} submissionUpload Pre-resolved bridge record
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, blocked, or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
 */
export const publishProcessSubmissionFeaturesJob = async (
  connection: IDBConnection,
  submissionUpload: SubmissionUpload,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

  try {
    if (TERMINAL_UPLOAD_STATUSES.includes(submissionUpload.status)) {
      defaultLog.warn({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Blocked: submission upload is terminal',
        submissionUploadId,
        uploadStatus: submissionUpload.status
      });

      return {
        status: 'blocked',
        message: `Submission upload is terminal with status '${submissionUpload.status}'`,
        existingStatus: submissionUpload.status
      };
    }

    if (!PROCESS_START_STATUSES.includes(submissionUpload.status)) {
      defaultLog.warn({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Blocked: submission upload is not process-startable',
        submissionUploadId,
        uploadStatus: submissionUpload.status
      });

      return {
        status: 'blocked',
        message: `Submission upload is not process-startable with status '${submissionUpload.status}'`,
        existingStatus: submissionUpload.status
      };
    }

    const submissionValidationService = publisherDependencies.createSubmissionValidationService(connection);

    // Check for existing validation record by submission_upload_id
    const existingValidation = await submissionValidationService.getSubmissionValidationBySubmissionUploadId(
      submissionUploadId
    );

    if (existingValidation) {
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
        message: 'Retrying validation for non-terminal upload',
        submissionUploadId,
        uploadStatus: submissionUpload.status,
        existingStatus: existingValidation.status,
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

    // Use singletonKey to prevent duplicate concurrent jobs for the same submission upload.
    const jobId = await boss.send(JobQueues.PROCESS_SUBMISSION_FEATURES, jobData, {
      ...mergedOptions,
      singletonKey: `submission-upload-${submissionUploadId}`,
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

      return { status: 'duplicate', message: 'Job already exists for this submission upload' };
    }
  } catch (error) {
    defaultLog.error({
      label: 'publishProcessSubmissionFeaturesJob',
      message: 'Failed to publish job',
      submissionUploadId,
      error
    });
    throw error;
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
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
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
    defaultLog.error({
      label: 'publishMalwareScanJob',
      message: 'Failed to publish job',
      artifactSecurityId: data.artifactSecurityId,
      error
    });
    throw error;
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
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws {ApiNotFoundError} When the download row does not exist.
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
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
      throw new ApiNotFoundError('Download not found', ['publishProcessDownloadJob', { downloadId: data.downloadId }]);
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
    defaultLog.error({
      label: 'publishProcessDownloadJob',
      message: 'Failed to publish job',
      downloadId: data.downloadId,
      error
    });
    throw error;
  }
};

/**
 * Publish a process download export job to the queue.
 *
 * Queues async CSV export packaging for an already-created `download_export`
 * row. The caller (route handler) creates the row inside an open transaction
 * and passes the same connection here; pg-boss's `db` option makes the job
 * insert participate in that transaction, so the row and the job either both
 * commit or both roll back — no ghost jobs and no orphaned exports.
 *
 * `singletonKey: export-{downloadExportId}` paired with `policy: 'short'` on
 * the queue (see worker.ts) prevents two concurrent jobs for the same export.
 *
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
 */
export const publishProcessDownloadExportJob = async (
  connection: IDBConnection,
  data: IProcessDownloadExportJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...PROCESS_DOWNLOAD_EXPORT_OPTIONS, ...options };

    await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_EXPORT);

    // Insert the job in the same transaction as the business data via the
    // `db` option. Prevents ghost jobs (job exists but data rolled back) and
    // lost jobs (data committed but job never sent).
    const db = {
      executeSql: async (text: string, values: any[]) => {
        const result = await connection.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      }
    };

    const jobId = await boss.send(JobQueues.PROCESS_DOWNLOAD_EXPORT, data, {
      ...mergedOptions,
      singletonKey: `export-${data.downloadExportId}`,
      db
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishProcessDownloadExportJob',
        message: 'Process download export job published',
        jobId,
        downloadExportId: data.downloadExportId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishProcessDownloadExportJob',
      message: 'Job not published (duplicate or throttled)',
      downloadExportId: data.downloadExportId
    });

    return { status: 'duplicate', message: 'Job already exists for this download export' };
  } catch (error) {
    defaultLog.error({
      label: 'publishProcessDownloadExportJob',
      message: 'Failed to publish job',
      downloadExportId: data.downloadExportId,
      error
    });
    throw error;
  }
};

/**
 * Publish a process download version export job to the queue.
 *
 * Queues async CSV export packaging for a shared artifact group. The job is keyed on the group
 * (`singletonKey: export-group-{id}`), so N user exports that attach to the same group trigger
 * exactly one packaging run — the dedupe winner enqueues, every later attach reuses the in-flight
 * or finished group without re-queueing.
 *
 * The caller (the request-time service) creates the export row and resolves the group inside an
 * open transaction and passes the same connection here; pg-boss's `db` option makes the job insert
 * participate in that transaction, so the row and the job either both commit or both roll back — no
 * ghost jobs and no orphaned exports.
 *
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
 */
export const publishProcessDownloadVersionExportJob = async (
  connection: IDBConnection,
  data: IProcessDownloadVersionExportJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...PROCESS_DOWNLOAD_VERSION_EXPORT_OPTIONS, ...options };

    await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT);

    // Insert the job in the same transaction as the business data via the
    // `db` option. Prevents ghost jobs (job exists but data rolled back) and
    // lost jobs (data committed but job never sent).
    const db = {
      executeSql: async (text: string, values: any[]) => {
        const result = await connection.query(text, values);
        return { rows: result.rows, rowCount: result.rowCount };
      }
    };

    const jobId = await boss.send(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT, data, {
      ...mergedOptions,
      singletonKey: `export-group-${data.downloadVersionExportArtifactGroupId}`,
      db
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishProcessDownloadVersionExportJob',
        message: 'Process download version export job published',
        jobId,
        downloadVersionExportArtifactGroupId: data.downloadVersionExportArtifactGroupId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishProcessDownloadVersionExportJob',
      message: 'Job not published (duplicate or throttled)',
      downloadVersionExportArtifactGroupId: data.downloadVersionExportArtifactGroupId
    });

    return { status: 'duplicate', message: 'Job already exists for this export artifact group' };
  } catch (error) {
    defaultLog.error({
      label: 'publishProcessDownloadVersionExportJob',
      message: 'Failed to publish job',
      downloadVersionExportArtifactGroupId: data.downloadVersionExportArtifactGroupId,
      error
    });
    throw error;
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
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
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

    // Use singletonKey to prevent duplicate concurrent indexing jobs for the same submission upload.
    // Pass caller's connection via db option so job insert is part of the same transaction
    const jobId = await boss.send(JobQueues.INDEX_SUBMISSION_FEATURES, data, {
      ...mergedOptions,
      singletonKey: `submission-upload-idx-${data.submissionUploadId}`,
      db: { executeSql: (text: string, values: any[]) => connection.query(text, values) }
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishIndexSubmissionFeaturesJob',
        message: 'Index submission features job published',
        jobId,
        submissionId: data.submissionId,
        submissionUploadId: data.submissionUploadId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishIndexSubmissionFeaturesJob',
      message: 'Job not published (duplicate or throttled)',
      submissionId: data.submissionId,
      submissionUploadId: data.submissionUploadId
    });

    return { status: 'duplicate', message: 'Job already exists for this submission upload' };
  } catch (error) {
    defaultLog.error({
      label: 'publishIndexSubmissionFeaturesJob',
      message: 'Failed to publish job',
      submissionId: data.submissionId,
      submissionUploadId: data.submissionUploadId,
      error
    });
    throw error;
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
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
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
    defaultLog.error({
      label: 'publishComputeScopeAnchorsJob',
      message: 'Failed to publish job',
      securityScopeId: data.securityScopeId,
      error
    });
    throw error;
  }
};

/**
 * Options for compute submission feature closure jobs.
 * The recompute is a single PG function call (DELETE + recursive-CTE INSERT) scoped to one upload.
 * Generous 2 hour expiry covers worst-case recompute on the largest closures without the job
 * expiring mid-flight.
 */
const COMPUTE_SUBMISSION_FEATURE_CLOSURE_OPTIONS: IPublishOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 * 2 // 2 hours
};

/**
 * Publish a compute submission feature closure job to the queue.
 *
 * Queues the async reachability-closure recompute for a submission upload. Uses the caller's
 * DB connection via pg-boss's `db` option so the job insert participates in
 * the same transaction — if the caller rolls back, the job is never visible.
 *
 * @param {IDBConnection} connection Database connection for transactional job insert
 * @param {IComputeSubmissionFeatureClosureJobData} data Job data containing submissionId and submissionUploadId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success or duplicate
 * @throws Rethrows any error from pg-boss (`boss.createQueue` / `boss.send`) after logging it;
 *         callers' surrounding transaction rolls back automatically.
 */
export const publishComputeSubmissionFeatureClosureJob = async (
  connection: IDBConnection,
  data: IComputeSubmissionFeatureClosureJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = publisherDependencies.getPgBoss();
    const mergedOptions = { ...COMPUTE_SUBMISSION_FEATURE_CLOSURE_OPTIONS, ...options };

    await boss.createQueue(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);

    // Use singletonKey to prevent duplicate concurrent closure recomputes for the same submission upload.
    // Pass caller's connection via db option so job insert is part of the same transaction
    const jobId = await boss.send(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE, data, {
      ...mergedOptions,
      singletonKey: `closure-recompute-${data.submissionUploadId}`,
      db: { executeSql: (text: string, values: any[]) => connection.query(text, values) }
    });

    if (jobId) {
      defaultLog.info({
        label: 'publishComputeSubmissionFeatureClosureJob',
        message: 'Compute submission feature closure job published',
        jobId,
        submissionId: data.submissionId,
        submissionUploadId: data.submissionUploadId
      });

      return { status: 'published', jobId };
    }

    defaultLog.warn({
      label: 'publishComputeSubmissionFeatureClosureJob',
      message: 'Job not published (duplicate or throttled)',
      submissionId: data.submissionId,
      submissionUploadId: data.submissionUploadId
    });

    return { status: 'duplicate', message: 'Job already exists for this submission upload' };
  } catch (error) {
    defaultLog.error({
      label: 'publishComputeSubmissionFeatureClosureJob',
      message: 'Failed to publish job',
      submissionId: data.submissionId,
      submissionUploadId: data.submissionUploadId,
      error
    });
    throw error;
  }
};
