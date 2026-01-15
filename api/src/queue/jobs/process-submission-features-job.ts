import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
//import { SubmissionProcessService } from '../../services/submission-process-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/process-submission-features-job');

/**
 * Process submission features job data interface.
 * Contains the submission ID for async processing of slow operations.
 */
export interface IProcessSubmissionFeaturesJobData {
  /** The submission ID to process */
  submissionId: number;
}

/**
 * Process submission features job handler.
 *
 * Processes a submission asynchronously:
 * 1. Downloads tarball from object storage
 * 2. Extracts and validates features
 * 3. Inserts feature records
 * 4. Indexes features for search
 * 5. Calculates and adds geographic regions
 *
 * @param {PgBoss.Job<IProcessSubmissionFeaturesJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IProcessSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId } = job.data;

    defaultLog.info({
      label: 'processSubmissionFeaturesJobHandler',
      message: 'Processing submission features job',
      jobId: job.id,
      submissionId
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionValidationService = new SubmissionValidationService(connection);

      // Commit 'started' status immediately so it's visible even if processing fails
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'started');
      await connection.commit();

      // Process the submission (download, validate, insert, index, regions)
      //TODO: call submission feature validation service;

      // Update validation status to completed
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'completed');
      await connection.commit();

      defaultLog.info({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job completed successfully',
        jobId: job.id,
        submissionId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed',
        jobId: job.id,
        submissionId,
        error
      });

      // Don't update status to 'failed' here - pg-boss will retry
      // Status will be set to 'failed' by Dead Letter Queue handler after all retries exhausted
      throw error;
    } finally {
      connection.release();
    }
  }
};

/**
 * Dead Letter Queue handler for failed process submission features jobs.
 *
 * This handler is called after all retries are exhausted. It updates the
 * submission validation status to 'failed' with error details.
 *
 * @param {PgBoss.Job<IProcessSubmissionFeaturesJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IProcessSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IProcessSubmissionFeaturesJobData>).output;

    defaultLog.warn({
      label: 'processSubmissionFeaturesFailedHandler',
      message: 'Processing failed job from dead letter queue',
      jobId: job.id,
      submissionId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionValidationService = new SubmissionValidationService(connection);

      // Update validation status to failed (all retries exhausted)
      // Use submissionId since DLQ job has a new job ID, not the original
      await submissionValidationService.updateSubmissionValidationStatusBySubmissionId(submissionId, 'failed', {
        error: jobOutput ?? 'Job failed after all retries'
      });

      await connection.commit();

      defaultLog.info({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed job status updated',
        jobId: job.id,
        submissionId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed to update failed job status',
        jobId: job.id,
        submissionId,
        error
      });

      throw error;
    } finally {
      connection.release();
    }
  }
};
