import PgBoss from 'pg-boss';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/index-submission-features-job');

const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];

function isTerminalSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return TERMINAL_UPLOAD_STATUSES.includes(status);
}

function isIndexStartableSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return status === 'ingested' || status === 'indexing';
}

/**
 * Run a single indexing attempt in one transaction.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Queue job id.
 * @returns {Promise<void>}
 */
async function runIndexSubmissionFeaturesStage(
  submissionId: number,
  submissionUploadId: string,
  jobId: string
): Promise<void> {
  await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    const currentUpload = await submissionUploadService.getSubmissionUpload(submissionUploadId);

    if (isTerminalSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.info({
        label: 'runIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is terminal',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return;
    }

    if (!isIndexStartableSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.warn({
        label: 'runIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is not index-startable',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return;
    }

    await submissionUploadService.transitionSubmissionUploadToIndexing(submissionUploadId);

    const featurePropertyIngestionService = new SubmissionFeaturePropertyIngestionService(connection);
    const outcome = await featurePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId(
      submissionId,
      submissionUploadId
    );

    if (outcome.status === 'invalid') {
      await submissionUploadService.transitionSubmissionUploadToInvalid(submissionUploadId);

      defaultLog.warn({
        label: 'runIndexSubmissionFeaturesStage',
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
      label: 'runIndexSubmissionFeaturesStage',
      message: 'Index submission features job completed successfully',
      jobId,
      submissionId,
      submissionUploadId
    });
  });
}

/**
 * Persist failed submission upload status in a dedicated transaction.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @returns {Promise<void>}
 */
async function transitionSubmissionUploadToFailedIfMutable(submissionUploadId: string): Promise<void> {
  try {
    await withConnection(async (connection) => {
      const submissionUploadService = new SubmissionUploadService(connection);
      const updated = await submissionUploadService.transitionSubmissionUploadToFailedIfMutable(
        submissionUploadId
      );

      if (!updated) {
        defaultLog.info({
          label: 'transitionSubmissionUploadToFailedIfMutable',
          message: 'Skipped terminal submission upload status overwrite',
          submissionUploadId,
          status: 'failed'
        });
      }
    });
  } catch (error) {
    defaultLog.error({
      label: 'transitionSubmissionUploadToFailedIfMutable',
      message: 'Failed to persist submission upload status',
      submissionUploadId,
      status: 'failed',
      error
    });
  }
}

/**
 * Index submission features job data interface.
 * Contains the submission ID for async search indexing.
 */
export interface IIndexSubmissionFeaturesJobData {
  /** The submission ID whose features should be indexed for search */
  submissionId: number;
  /** The submission upload ID whose rows should be validated/indexed */
  submissionUploadId: string;
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
      await transitionSubmissionUploadToFailedIfMutable(submissionUploadId);

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
