import PgBoss from 'pg-boss';
import { TERMINAL_UPLOAD_STATUSES } from '../../constants/submission-upload';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionFeaturePropertyValidationOutcome } from '../../services/ingestion/submission-feature-property-ingestion-service.interface';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

/**
 * Index submission features job data interface.
 * Contains submission scope for async deep property indexing/validation.
 */
export interface IIndexSubmissionFeaturesJobData {
  /** The submission ID whose features should be indexed for search */
  submissionId: number;
  /** The submission upload ID whose rows should be validated/indexed */
  submissionUploadId: string;
}

const defaultLog = getLogger('queue/jobs/index-submission-features-job');

/**
 * Return true when a submission upload status is terminal.
 *
 * @param {SubmissionUpload['status']} status Submission upload status.
 * @returns {boolean} True when status is terminal.
 */
function isTerminalSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return TERMINAL_UPLOAD_STATUSES.includes(status);
}

/**
 * Return true when the index stage can start or resume from the status.
 *
 * @param {SubmissionUpload['status']} status Submission upload status.
 * @returns {boolean} True when status is index-startable.
 */
function isIndexStartableSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return status === 'ingested' || status === 'indexing';
}

/**
 * Initialize index stage guard/entry transition.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<boolean>} True when stage should proceed.
 */
async function initializeIndexSubmissionFeaturesStage(submissionUploadId: string, jobId: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    const currentUpload = await submissionUploadService.getSubmissionUpload(submissionUploadId);

    if (isTerminalSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.info({
        label: 'initializeIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is terminal',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return false;
    }

    if (!isIndexStartableSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.warn({
        label: 'initializeIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is not index-startable',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return false;
    }

    await submissionUploadService.transitionSubmissionUploadToIndexing(submissionUploadId);
    return true;
  });
}

/**
 * Execute heavy indexing work for one submission upload.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @returns {Promise<SubmissionFeaturePropertyValidationOutcome>} Validation/indexing outcome.
 */
async function executeIndexSubmissionFeaturesIngestion(
  submissionId: number,
  submissionUploadId: string
): Promise<SubmissionFeaturePropertyValidationOutcome> {
  return withConnection(async (connection) => {
    const featurePropertyIngestionService = new SubmissionFeaturePropertyIngestionService(connection);
    return featurePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId(
      submissionId,
      submissionUploadId
    );
  });
}

/**
 * Finalize index stage by persisting terminal status from outcome.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @param {SubmissionFeaturePropertyValidationOutcome} outcome Indexing outcome.
 * @returns {Promise<void>}
 */
async function finalizeIndexSubmissionFeaturesStage(
  submissionId: number,
  submissionUploadId: string,
  jobId: string,
  outcome: SubmissionFeaturePropertyValidationOutcome
): Promise<void> {
  await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);

    if (outcome.status === 'invalid') {
      await submissionUploadService.transitionSubmissionUploadToInvalid(submissionUploadId);

      defaultLog.warn({
        label: 'finalizeIndexSubmissionFeaturesStage',
        message: 'Index submission features job completed with validation errors',
        jobId,
        submissionId,
        submissionUploadId,
        errorCount: outcome.errorCount,
        errorCounts: outcome.errorCounts
      });

      return;
    }

    await submissionUploadService.transitionSubmissionUploadToIndexed(submissionUploadId);

    defaultLog.info({
      label: 'finalizeIndexSubmissionFeaturesStage',
      message: 'Index submission features job completed successfully',
      jobId,
      submissionId,
      submissionUploadId
    });
  });
}

/**
 * Orchestrate the index stage workflow.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<void>}
 */
async function runIndexSubmissionFeaturesStage(
  submissionId: number,
  submissionUploadId: string,
  jobId: string
): Promise<void> {
  const shouldRun = await initializeIndexSubmissionFeaturesStage(submissionUploadId, jobId);
  if (!shouldRun) {
    return;
  }

  const outcome = await executeIndexSubmissionFeaturesIngestion(submissionId, submissionUploadId);
  await finalizeIndexSubmissionFeaturesStage(submissionId, submissionUploadId, jobId, outcome);
}

/**
 * Index submission features job handler.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const indexSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IIndexSubmissionFeaturesJobData> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    defaultLog.info({
      label: 'indexSubmissionFeaturesJobHandler',
      message: 'Processing index submission features job',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });

    try {
      await runIndexSubmissionFeaturesStage(submissionId, submissionUploadId, job.id);
    } catch (error) {
      await withConnection(async (connection) => {
        const submissionUploadService = new SubmissionUploadService(connection);
        await submissionUploadService.transitionSubmissionUploadStatus(submissionUploadId, 'failed', [
          'uploaded',
          'ingesting',
          'ingested',
          'indexing'
        ]);
      });

      defaultLog.error({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job failed',
        jobId: job.id,
        submissionId,
        submissionUploadId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    }
  }
};

/**
 * Dead Letter Queue handler for failed index submission features jobs.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const indexSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IIndexSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IIndexSubmissionFeaturesJobData>).output;

    defaultLog.warn({
      label: 'indexSubmissionFeaturesFailedHandler',
      message: 'Index submission features job failed after all retries',
      jobId: job.id,
      submissionId,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
