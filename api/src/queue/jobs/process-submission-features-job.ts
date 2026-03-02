import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { IngestionJobData } from '../../models/submission-upload';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { getLogger } from '../../utils/logger';
import { publishIndexSubmissionFeaturesJob } from '../publisher';

const defaultLog = getLogger('queue/jobs/process-submission-features-job');

/**
 * Process submission features job handler.
 *
 * Processes a submission asynchronously:
 * 1. Downloads tarball from object storage
 * 2. Extracts and validates features
 * 3. Inserts feature records
 * 4. Indexes features for search
 *
 * @param {PgBoss.Job<IngestionJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IngestionJobData> = async (jobs) => {
  for (const job of jobs) {
    const { uploadId, submissionId } = job.data;

    defaultLog.info({
      label: 'processSubmissionFeaturesJobHandler',
      message: 'Processing submission features job',
      jobId: job.id,
      uploadId,
      submissionId
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionValidationService = new SubmissionValidationService(connection);

      // Commit 'started' status immediately so it's visible even if processing fails
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'started');
      await connection.commit();

      // Process the submission (two-pass: validate → ingest)
      const submissionIngestionService = new SubmissionIngestionService(connection);
      const result = await submissionIngestionService.processSubmission(job.data);

      if (!result.valid) {
        // Validation failure — permanent condition, don't retry
        await submissionValidationService.updateSubmissionValidationStatus(job.id, 'invalid', {
          errors: result.errors
        });
        await connection.commit();

        defaultLog.info({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Submission validation failed (invalid data)',
          jobId: job.id,
          submissionId,
          errorCount: result.errors.length
        });

        return;
      }

      // Update validation status to completed
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'completed');
      await connection.commit();

      // Publish indexing job (fire-and-forget — failure here doesn't affect validation).
      // Validation success is the critical path; indexing can be retried independently via admin endpoint.
      const indexResult = await publishIndexSubmissionFeaturesJob(connection, { submissionId });
      if (indexResult.status !== 'published') {
        defaultLog.warn({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Index submission features job not published',
          submissionId,
          indexResult
        });
      }

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

      // Don't update status to 'failed' here — rethrow so pg-boss moves the job to DLQ.
      // DLQ handler sets the validation status to 'failed'.
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
 * @param {PgBoss.Job<IngestionJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IngestionJobData> = async (jobs) => {
  for (const job of jobs) {
    const { uploadId, submissionId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IngestionJobData>).output;

    defaultLog.warn({
      label: 'processSubmissionFeaturesFailedHandler',
      message: 'Processing failed job from dead letter queue',
      jobId: job.id,
      uploadId,
      submissionId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionValidationService = new SubmissionValidationService(connection);

      // Update validation status to failed (all retries exhausted)
      // Use uploadId since DLQ job has a new job ID, not the original
      await submissionValidationService.updateSubmissionValidationStatusByUploadId(uploadId, 'failed', {
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
