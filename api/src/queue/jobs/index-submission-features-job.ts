import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/index-submission-features-job');

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
 * Indexes submission features for deep validation/property resolution after shallow ingestion.
 * Indexing errors invalidate the submission upload because this stage performs canonical
 * validation and relationship/artifact resolution.
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
      submissionId
    });

    const connection = getAPIUserDBConnection();
    try {
      await connection.open();

      const featurePropertyIngestionService = new SubmissionFeaturePropertyIngestionService(connection);
      const submissionUploadService = new SubmissionUploadService(connection);
      await featurePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId(
        submissionId,
        submissionUploadId
      );
      await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'succeeded' });

      await connection.commit();

      defaultLog.info({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job completed successfully',
        jobId: job.id,
        submissionId
      });
    } catch (error) {
      await connection.rollback();

      try {
        const submissionUploadService = new SubmissionUploadService(connection);
        await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'invalid' });
        await connection.commit();
      } catch (statusError) {
        await connection.rollback();
        defaultLog.error({
          label: 'indexSubmissionFeaturesJobHandler',
          message: 'Failed to update submission upload status',
          jobId: job.id,
          submissionUploadId,
          error: statusError
        });
      }

      defaultLog.error({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job failed',
        jobId: job.id,
        submissionId,
        submissionUploadId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    } finally {
      connection.release();
    }
  }
};

/**
 * Dead Letter Queue handler for failed index submission features jobs.
 *
 * Indexing DLQ handler logs final retry exhaustion details.
 * Submission upload status is already set to `invalid` in the main handler catch path.
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
