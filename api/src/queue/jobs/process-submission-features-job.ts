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

const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];
const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];
const MUTABLE_UPLOAD_STATUSES: SubmissionUpload['status'][] = [
  'uploaded',
  'ingesting',
  'ingested',
  'indexing'
];

function isTerminalStatus(status: SubmissionUpload['status']): boolean {
  return TERMINAL_UPLOAD_STATUSES.includes(status);
}

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
    const updated = await submissionUploadService.tryTransitionSubmissionUploadStatus(
      submissionUploadId,
      status,
      MUTABLE_UPLOAD_STATUSES
    );

    await statusConnection.commit();

    if (!updated) {
      defaultLog.info({
        label: 'updateSubmissionUploadStatusInNewTransaction',
        message: 'Skipped terminal submission upload status overwrite',
        submissionUploadId,
        status
      });
    }
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
 * @param {PgBoss.Job<SubmissionUpload>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesJobHandler: PgBoss.WorkHandler<SubmissionUpload> = async (jobs) => {
  for (const job of jobs) {
    const submissionUpload = job.data;
    const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

    defaultLog.info({
      label: 'processSubmissionFeaturesJobHandler',
      message: 'Processing submission features job',
      jobId: job.id,
      submissionUploadId,
      submissionId
    });

    // Phase A: guard start transition and mark ingestion started.
    const startConnection = getAPIUserDBConnection();

    try {
      await startConnection.open();

      const submissionUploadService = new SubmissionUploadService(startConnection);
      const submissionValidationService = new SubmissionValidationService(startConnection);
      const currentUpload = await submissionUploadService.getSubmissionUpload(submissionUploadId);

      if (isTerminalStatus(currentUpload.status)) {
        defaultLog.info({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Skipping process job because submission upload is terminal',
          jobId: job.id,
          submissionUploadId,
          status: currentUpload.status
        });

        await startConnection.commit();
        continue;
      }

      if (!PROCESS_START_STATUSES.includes(currentUpload.status)) {
        defaultLog.warn({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Skipping process job because submission upload is not in a process-startable state',
          jobId: job.id,
          submissionUploadId,
          status: currentUpload.status
        });

        await startConnection.commit();
        continue;
      }

      if (currentUpload.status === 'uploaded') {
        await submissionUploadService.tryTransitionSubmissionUploadStatus(submissionUploadId, 'ingesting', [
          'uploaded'
        ]);
      }

      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'started');
      await startConnection.commit();
    } catch (error) {
      await startConnection.rollback();
      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Failed to initialize process job transition',
        jobId: job.id,
        submissionUploadId,
        error
      });
      throw error;
    } finally {
      startConnection.release();
    }

    let ingestionResult: Awaited<ReturnType<SubmissionIngestionService['ingestSubmissionUpload']>>;

    // Phase B: run ingestion and commit raw writes.
    const ingestionConnection = getAPIUserDBConnection();
    try {
      await ingestionConnection.open();

      const ingestStart = Date.now();
      const submissionIngestionService = new SubmissionIngestionService(ingestionConnection);

      ingestionResult = await submissionIngestionService.ingestSubmissionUpload(submissionUpload);

      defaultLog.debug({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Completed submission archive ingestion',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        elapsedMs: Date.now() - ingestStart,
        valid: ingestionResult.valid
      });

      await ingestionConnection.commit();
    } catch (error) {
      await ingestionConnection.rollback();

      const errorMetadata = toErrorMetadata(error);

      if (isValidationFailure(error)) {
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

      await updateSubmissionUploadStatusInNewTransaction(submissionUploadId, 'failed');

      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed during ingestion',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        error: errorMetadata
      });

      throw error;
    } finally {
      ingestionConnection.release();
    }

    if (!ingestionResult.valid) {
      // Deterministic raw-ingestion validation failure.
      const invalidConnection = getAPIUserDBConnection();

      try {
        await invalidConnection.open();

        const submissionValidationService = new SubmissionValidationService(invalidConnection);
        const submissionUploadService = new SubmissionUploadService(invalidConnection);

        await submissionValidationService.updateSubmissionValidationStatus(job.id, 'invalid', {
          errors: ingestionResult.errors
        });

        await submissionUploadService.tryTransitionSubmissionUploadStatus(submissionUploadId, 'invalid', [
          'uploaded',
          'ingesting',
          'ingested',
          'indexing'
        ]);

        await invalidConnection.commit();

        defaultLog.info({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Submission validation failed (invalid data)',
          jobId: job.id,
          submissionId,
          submissionUploadId,
          errorCount: ingestionResult.errors.length
        });
      } catch (error) {
        await invalidConnection.rollback();
        defaultLog.error({
          label: 'processSubmissionFeaturesJobHandler',
          message: 'Failed to persist invalid status after ingestion validation failure',
          jobId: job.id,
          submissionUploadId,
          error
        });
        throw error;
      } finally {
        invalidConnection.release();
      }

      continue;
    }

    // Phase C: finalize as ingested in durable DB state.
    const finalizeConnection = getAPIUserDBConnection();
    let finalizedAsIngested = false;

    try {
      await finalizeConnection.open();

      const submissionValidationService = new SubmissionValidationService(finalizeConnection);
      const submissionUploadService = new SubmissionUploadService(finalizeConnection);
      const uploadArchiveService = new UploadArchiveService(finalizeConnection);

      await submissionValidationService.updateSubmissionValidationStatus(job.id, 'completed');

      finalizedAsIngested = await submissionUploadService.tryTransitionSubmissionUploadStatus(
        submissionUploadId,
        'ingested',
        ['ingesting', 'ingested']
      );

      await uploadArchiveService.updateUploadArchivesByUploadId(submissionUpload.upload_id, {
        archive_status: ProcessStatusStatusEnum.COMPLETED
      });

      await finalizeConnection.commit();
    } catch (error) {
      await finalizeConnection.rollback();

      const errorMetadata = toErrorMetadata(error);
      await updateSubmissionUploadStatusInNewTransaction(submissionUploadId, 'failed');

      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed during finalize phase',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        error: errorMetadata
      });

      throw error;
    } finally {
      finalizeConnection.release();
    }

    if (!finalizedAsIngested) {
      defaultLog.info({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Skipped enqueue because finalize transition to ingested did not apply',
        jobId: job.id,
        submissionUploadId,
        submissionId
      });

      continue;
    }

    // Phase D: enqueue downstream work after ingested commit. Queue publish is best effort.
    const publishConnection = getAPIUserDBConnection();
    try {
      await publishConnection.open();

      const publishStart = Date.now();
      const indexResult = await publishIndexSubmissionFeaturesJob(publishConnection, {
        submissionId,
        submissionUploadId
      });

      await publishConnection.commit();

      const publishMetrics = {
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Index submission publish attempt completed',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        elapsedMs: Date.now() - publishStart,
        indexResult
      };

      if (indexResult.status === 'error') {
        defaultLog.warn(publishMetrics);
      } else {
        defaultLog.info(publishMetrics);
      }
    } catch (publishError) {
      await publishConnection.rollback();

      defaultLog.warn({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Index submission publish failed after ingested commit; leaving status as ingested',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        error: toErrorMetadata(publishError)
      });
    } finally {
      publishConnection.release();
    }

    defaultLog.info({
      label: 'processSubmissionFeaturesJobHandler',
      message: 'Process submission features job completed successfully',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });
  }
};

/**
 * Dead Letter Queue handler for failed process submission features jobs.
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

      await submissionValidationService.updateSubmissionValidationStatusBySubmissionUploadId(
        submissionUploadId,
        'failed',
        {
          error: jobOutput ?? 'Job failed after all retries'
        }
      );

      await submissionUploadService.tryTransitionSubmissionUploadStatus(submissionUploadId, 'failed', MUTABLE_UPLOAD_STATUSES);

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
