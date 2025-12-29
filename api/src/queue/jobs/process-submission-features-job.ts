import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { SubmissionProcessService } from '../../services/submission-process-service';
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
      const submissionProcessService = new SubmissionProcessService(connection);

      // Update validation status to started
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'started');

      // Process the submission (download, validate, insert, index, regions)
      await submissionProcessService.processSubmission(submissionId);

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

      // Update validation status to failed
      try {
        const validationConnection = getAPIUserDBConnection();
        await validationConnection.open();
        const submissionValidationService = new SubmissionValidationService(validationConnection);
        await submissionValidationService.updateSubmissionValidationStatus(job.id, 'failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        await validationConnection.commit();
        validationConnection.release();
      } catch (validationError) {
        defaultLog.error({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Failed to update submission validation status',
          jobId: job.id,
          error: validationError
        });
      }

      throw error; // pg-boss will handle retry based on configuration
    } finally {
      connection.release();
    }
  }
};
