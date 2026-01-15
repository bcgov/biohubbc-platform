import { IDBConnection } from '../database/db';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IMalwareScanJobData } from './jobs/malware-scan-job';
import { IProcessSubmissionFeaturesJobData } from './jobs/process-submission-features-job';
import { ITestJobData } from './jobs/test-job';
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

const DEFAULT_OPTIONS: IPublishOptions = {
  retryLimit: 2,
  retryDelay: 60,
  retryBackoff: true,
  expireInSeconds: 60 * 60 // 1 hour
};

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
 * Shorter timeout since indexing/regions should complete in minutes.
 */
const PROCESS_SUBMISSION_FEATURES_OPTIONS: IPublishOptions = {
  retryLimit: 3,
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
  expireInSeconds: 60 * 30 // 30 minutes
};

/**
 * Publish a test job to the queue.
 *
 * This is a template demonstrating the pattern for publishing jobs.
 * Create similar functions for each job type.
 *
 * @param {ITestJobData} data Job data
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {(Promise<string | null>)} Job ID if successful, null otherwise
 */
export const publishTestJob = async (data: ITestJobData, options: IPublishOptions = {}): Promise<string | null> => {
  const boss = getPgBoss();
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Ensure queue exists before sending jobs
  await boss.createQueue(JobQueues.TEST);

  const jobId = await boss.send(JobQueues.TEST, data, mergedOptions);

  defaultLog.info({
    label: 'publishTestJob',
    message: 'Job published',
    jobId,
    data
  });

  return jobId;
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
 * @param {IDBConnection} connection Database connection for submission validation tracking
 * @param {IProcessSubmissionFeaturesJobData} data Job data containing submissionId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, blocked, duplicate, or error
 */
export const publishProcessSubmissionFeaturesJob = async (
  connection: IDBConnection,
  data: IProcessSubmissionFeaturesJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const submissionValidationService = new SubmissionValidationService(connection);

    // Check for existing validation record
    const existingValidation = await submissionValidationService.getSubmissionValidationBySubmissionId(
      data.submissionId
    );

    if (existingValidation) {
      // Only allow retry if status is 'failed'
      if (existingValidation.status !== 'failed') {
        defaultLog.warn({
          label: 'publishProcessSubmissionFeaturesJob',
          message: 'Blocked: validation record already exists',
          submissionId: data.submissionId,
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
        submissionId: data.submissionId,
        previousJobId: existingValidation.job_id
      });
    }

    const boss = getPgBoss();
    const mergedOptions = { ...PROCESS_SUBMISSION_FEATURES_OPTIONS, ...options };

    // Ensure queue exists before sending jobs
    await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES);

    // Use singletonKey to prevent duplicate concurrent jobs for the same submission
    const jobId = await boss.send(JobQueues.PROCESS_SUBMISSION_FEATURES, data, {
      ...mergedOptions,
      singletonKey: `submission-${data.submissionId}`
    });

    // jobId is null when pg-boss rejects the job (e.g., duplicate singletonKey still active)
    if (jobId) {
      // Create submission validation record for tracking
      await submissionValidationService.createSubmissionValidation(data.submissionId, jobId);

      defaultLog.info({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Process submission features job published',
        jobId,
        submissionId: data.submissionId
      });

      return { status: 'published', jobId };
    } else {
      defaultLog.warn({
        label: 'publishProcessSubmissionFeaturesJob',
        message: 'Job not published (duplicate or throttled)',
        submissionId: data.submissionId
      });

      return { status: 'duplicate', message: 'Job already exists for this submission' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    defaultLog.error({
      label: 'publishProcessSubmissionFeaturesJob',
      message: 'Failed to publish job',
      submissionId: data.submissionId,
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
 * @param {IMalwareScanJobData} data Job data containing artifactSecurityId
 * @param {IPublishOptions} [options={}] Job options
 * @return {*}  {Promise<PublishJobResult>} Result indicating success, duplicate, or error
 */
export const publishMalwareScanJob = async (
  data: IMalwareScanJobData,
  options: IPublishOptions = {}
): Promise<PublishJobResult> => {
  try {
    const boss = getPgBoss();
    const mergedOptions = { ...MALWARE_SCAN_OPTIONS, ...options };

    // Ensure queue exists (pg-boss v10 requires this before send)
    await boss.createQueue(JobQueues.MALWARE_SCAN);

    // Use singletonKey to prevent duplicate concurrent jobs for the same artifact security record
    const jobId = await boss.send(JobQueues.MALWARE_SCAN, data, {
      ...mergedOptions,
      singletonKey: `artifact-security-${data.artifactSecurityId}`
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
