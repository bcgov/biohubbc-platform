import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { SearchFeatureService } from '../../services/search-feature-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/index-submission-features-job');

/**
 * Index submission features job data interface.
 * Contains the submission ID for async search indexing.
 */
export interface IIndexSubmissionFeaturesJobData {
  /** The submission ID whose features should be indexed for search */
  submissionId: number;
}

/**
 * Index submission features job handler.
 *
 * Indexes submission features for search asynchronously after validation completes.
 * Indexing is a separate concern from validation — a failed index does not invalidate
 * the submission. The DLQ handler logs but does not affect validation status.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const indexSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IIndexSubmissionFeaturesJobData> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId } = job.data;

    defaultLog.info({
      label: 'indexSubmissionFeaturesJobHandler',
      message: 'Processing index submission features job',
      jobId: job.id,
      submissionId
    });

    const connection = getAPIUserDBConnection();
    try {
      await connection.open();

      const searchFeatureService = new SearchFeatureService(connection);
      await searchFeatureService.indexSubmissionPropertiesBySubmissionId(submissionId);

      await connection.commit();

      defaultLog.info({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job completed successfully',
        jobId: job.id,
        submissionId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job failed',
        jobId: job.id,
        submissionId,
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
 * Indexing failure is independent of validation — a failed index does not invalidate
 * the submission. This handler only logs the failure with error details. There is no
 * tracking record to update (unlike malware scan or download jobs), so no DB connection
 * is needed.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const indexSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IIndexSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IIndexSubmissionFeaturesJobData>).output;

    defaultLog.warn({
      label: 'indexSubmissionFeaturesFailedHandler',
      message: 'Index submission features job failed after all retries',
      jobId: job.id,
      submissionId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
