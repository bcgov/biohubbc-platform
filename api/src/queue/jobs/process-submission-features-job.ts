import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadArchiveService } from '../../services/upload/upload-archive-service';
import { getLogger } from '../../utils/logger';
import { publishIndexSubmissionFeaturesJob } from '../publisher';

const defaultLog = getLogger('queue/jobs/process-submission-features-job');

/**
 * Serialize unknown thrown values into structured log-safe metadata.
 *
 * @param {unknown} error - Unknown thrown value.
 * @returns {{ name: string; message: string; stack?: string }} Serializable error details.
 */
function toErrorMetadata(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

/**
 * Return true when a thrown ingestion error represents permanent validation failure.
 *
 * These cases should mark validation/upload as invalid and avoid DLQ retries.
 *
 * @param {unknown} error - Thrown ingestion error.
 * @returns {boolean} True when the error is a validation failure.
 */
function isValidationFailure(error: unknown): boolean {
  return error instanceof IngestionValidationError;
}

/**
 * Persist submission upload status in a dedicated transaction after the main transaction is rolled back.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @param {'invalid' | 'failed'} status Status to persist.
 * @returns {Promise<void>}
 */
async function updateSubmissionUploadStatusInNewTransaction(
  submissionUploadId: string,
  status: 'invalid' | 'failed'
): Promise<void> {
  const statusConnection = getAPIUserDBConnection();

  try {
    await statusConnection.open();

    const submissionUploadService = new SubmissionUploadService(statusConnection);
    await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status });

    await statusConnection.commit();
  } catch (statusError) {
    await statusConnection.rollback();

    defaultLog.error({
      label: 'updateSubmissionUploadStatusInNewTransaction',
      message: 'Failed to persist submission upload status in new transaction',
      submissionUploadId,
      status,
      error: statusError
    });
  } finally {
    statusConnection.release();
  }
}

/**
 * Persist submission validation status in a dedicated transaction after the main transaction is rolled back.
 *
 * @param {string} jobId Process submission features job ID.
 * @param {{ error: { name: string; message: string; stack?: string } }} result Validation payload.
 * @returns {Promise<void>}
 */
async function updateSubmissionValidationInvalidInNewTransaction(
  jobId: string,
  result: { error: { name: string; message: string; stack?: string } }
): Promise<void> {
  const statusConnection = getAPIUserDBConnection();

  try {
    await statusConnection.open();

    const submissionValidationService = new SubmissionValidationService(statusConnection);
    await submissionValidationService.updateSubmissionValidationStatus(jobId, 'invalid', result);

    await statusConnection.commit();
  } catch (statusError) {
    await statusConnection.rollback();

    defaultLog.error({
      label: 'updateSubmissionValidationInvalidInNewTransaction',
      message: 'Failed to persist submission validation status in new transaction',
      jobId,
      error: statusError
    });
  } finally {
    statusConnection.release();
  }
}

/**
 * Process submission features job handler.
 *
 * Receives the full SubmissionUpload bridge record in the job payload,
 * avoiding an extra DB lookup at startup.
 *
 * Processes a submission asynchronously:
 * 1. Downloads tarball from object storage
 * 2. Streams and shallow-ingests features/media
 * 3. Enqueues indexing job for deep validation and property resolution
 *
 * @param {PgBoss.Job<SubmissionUpload>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesJobHandler: PgBoss.WorkHandler<SubmissionUpload> = async (jobs) => {
  for (const job of jobs) {
    const submissionUpload = job.data;
    const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      defaultLog.info({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Processing submission features job',
        jobId: job.id,
        submissionUploadId,
        submissionId
      });

      const submissionValidationService = new SubmissionValidationService(connection);
      const submissionUploadService = new SubmissionUploadService(connection);

      // Mark started/in_progress within the current transaction.
      // Final commit occurs once per job after ingestion + enqueue decisions are complete.
      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'started');
      await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'in_progress' });

      // Process the submission (streaming shallow-ingestion).
      const ingestStart = Date.now();
      defaultLog.debug({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Starting submission archive ingestion',
        jobId: job.id,
        submissionUploadId,
        submissionId
      });
      const submissionIngestionService = new SubmissionIngestionService(connection);
      const result = await submissionIngestionService.ingestSubmissionUpload(submissionUpload);
      defaultLog.debug({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Completed submission archive ingestion',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        elapsedMs: Date.now() - ingestStart,
        valid: result.valid
      });

      let invalidErrorCount: number | null = null;

      if (!result.valid) {
        // Validation failure — permanent condition, don't retry
        await submissionValidationService.updateSubmissionValidationStatus(job.id, 'invalid', {
          errors: result.errors
        });
        await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'invalid' });
        invalidErrorCount = result.errors.length;
      } else {
        // Update ingestion status to completed; deep validation is handled by indexing.
        // These updates are independent and can run concurrently within the same transaction.
        const uploadArchiveService = new UploadArchiveService(connection);
        await Promise.all([
          submissionValidationService.updateSubmissionValidationStatus(job.id, 'completed'),
          submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'succeeded' }),
          uploadArchiveService.updateUploadArchivesByUploadId(submissionUpload.upload_id, {
            archive_status: ProcessStatusStatusEnum.COMPLETED
          })
        ]);

        // Publish indexing job. Status updates + enqueue happen in the same transaction/commit window.
        const publishStart = Date.now();
        defaultLog.debug({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Publishing index submission features job',
          jobId: job.id,
          submissionUploadId,
          submissionId
        });
        const indexResult = await publishIndexSubmissionFeaturesJob(connection, {
          submissionId,
          submissionUploadId
        });
        defaultLog.debug({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Finished publishing index submission features job',
          jobId: job.id,
          submissionUploadId,
          submissionId,
          elapsedMs: Date.now() - publishStart,
          indexResult
        });
        if (indexResult.status !== 'published') {
          defaultLog.warn({
            label: 'processSubmissionFeaturesJobHandler',
            message: 'Index submission features job not published',
            submissionId,
            indexResult
          });
        }
      }

      // Single commit for this connection/job execution path.
      await connection.commit();

      if (invalidErrorCount !== null) {
        defaultLog.info({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Submission validation failed (invalid data)',
          jobId: job.id,
          submissionId,
          errorCount: invalidErrorCount
        });

        continue;
      }

      defaultLog.info({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job completed successfully',
        jobId: job.id,
        submissionId
      });
    } catch (error) {
      await connection.rollback();

      const errorMetadata = toErrorMetadata(error);

      if (isValidationFailure(error)) {
        // Validation failure from ingestion parser/shape checks — permanent condition, don't retry.
        await updateSubmissionValidationInvalidInNewTransaction(job.id, {
          error: errorMetadata
        });
        await updateSubmissionUploadStatusInNewTransaction(submissionUploadId, 'invalid');

        defaultLog.warn({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Submission validation failed during ingestion',
          jobId: job.id,
          submissionUploadId,
          submissionId,
          error: errorMetadata
        });

        continue;
      }

      try {
        await updateSubmissionUploadStatusInNewTransaction(submissionUploadId, 'failed');
      } catch (statusError) {
        defaultLog.error({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Failed to update submission upload status to failed',
          jobId: job.id,
          submissionUploadId,
          error: statusError
        });
      }

      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed',
        jobId: job.id,
        submissionUploadId,
        error: errorMetadata
      });

      // Rethrow so pg-boss moves the job to DLQ.
      // DLQ handler persists final validation failure state for observability.
      throw error;
    } finally {
      connection.release();
    }
  }
};

/**
 * Dead Letter Queue handler for failed process submission features jobs.
 *
 * DLQ creates a new job with a new job_id. The original validation record is found
 * via submission_upload_id, not the (now-different) job_id.
 *
 * @param {PgBoss.Job<SubmissionUpload>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<SubmissionUpload> = async (jobs) => {
  for (const job of jobs) {
    const { submission_upload_id: submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<SubmissionUpload>).output;

    defaultLog.warn({
      label: 'processSubmissionFeaturesFailedHandler',
      message: 'Processing failed job from dead letter queue',
      jobId: job.id,
      submissionUploadId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionValidationService = new SubmissionValidationService(connection);
      const submissionUploadService = new SubmissionUploadService(connection);

      // Update validation status to failed (all retries exhausted)
      // Use submissionUploadId since DLQ job has a new job ID, not the original
      await submissionValidationService.updateSubmissionValidationStatusBySubmissionUploadId(
        submissionUploadId,
        'failed',
        {
          error: jobOutput ?? 'Job failed after all retries'
        }
      );
      await submissionUploadService.updateSubmissionUpload(submissionUploadId, { status: 'failed' });

      await connection.commit();

      defaultLog.info({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed job status updated',
        jobId: job.id,
        submissionUploadId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed to update failed job status',
        jobId: job.id,
        submissionUploadId,
        error
      });

      throw error;
    } finally {
      connection.release();
    }
  }
};
