import PgBoss from 'pg-boss';
import { IngestionValidationError } from '../../errors/submission-errors';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadArchiveService } from '../../services/upload/upload-archive-service';
import { getLogger } from '../../utils/logger';
import { publishIndexSubmissionFeaturesJob } from '../publisher';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/process-submission-features-job');

const TERMINAL_UPLOAD_STATUSES: SubmissionUpload['status'][] = ['indexed', 'invalid', 'failed'];
const PROCESS_START_STATUSES: SubmissionUpload['status'][] = ['uploaded', 'ingesting'];

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
 * Return true when process stage can start/resume from status.
 *
 * @param {SubmissionUpload['status']} status Submission upload status.
 * @returns {boolean} True when status is process-startable.
 */
function isProcessStartableSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return PROCESS_START_STATUSES.includes(status);
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
 * Initialize process stage guard and stage-entry transition.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<boolean>} True when stage should proceed.
 */
async function initializeProcessSubmissionFeaturesStage(submissionUploadId: string, jobId: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    const submissionValidationService = new SubmissionValidationService(connection);
    const currentUpload = await submissionUploadService.getSubmissionUpload(submissionUploadId);

    if (isTerminalSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.info({
        label: 'initializeProcessSubmissionFeaturesStage',
        message: 'Skipping process job because submission upload is terminal',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });

      return false;
    }

    if (!isProcessStartableSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.warn({
        label: 'initializeProcessSubmissionFeaturesStage',
        message: 'Skipping process job because submission upload is not in a process-startable state',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });

      return false;
    }

    await submissionUploadService.transitionSubmissionUploadToIngesting(submissionUploadId);
    await submissionValidationService.updateSubmissionValidationStatus(jobId, 'started');

    return true;
  });
}

type ProcessSubmissionFeaturesExecutionOutcome =
  | { status: 'ok' }
  | {
      status: 'invalid';
      validationPayload: { errors?: unknown[]; error?: { name: string; message: string; stack?: string } };
      errorCount: number;
    };

/**
 * Execute ingestion work and map validation outcomes.
 *
 * @param {SubmissionUpload} submissionUpload Submission upload payload from queue.
 * @param {string} jobId Job identifier.
 * @returns {Promise<ProcessSubmissionFeaturesExecutionOutcome>} Execution outcome.
 */
async function executeProcessSubmissionFeaturesIngestion(
  submissionUpload: SubmissionUpload,
  jobId: string
): Promise<ProcessSubmissionFeaturesExecutionOutcome> {
  return withConnection(async (connection) => {
    const ingestStart = Date.now();
    const submissionIngestionService = new SubmissionIngestionService(connection);

    try {
      const ingestionResult = await submissionIngestionService.ingestSubmissionUpload(submissionUpload);

      defaultLog.debug({
        label: 'executeProcessSubmissionFeaturesIngestion',
        message: 'Completed submission archive ingestion',
        jobId,
        submissionUploadId: submissionUpload.submission_upload_id,
        submissionId: submissionUpload.submission_id,
        elapsedMs: Date.now() - ingestStart,
        valid: ingestionResult.valid
      });

      if (!ingestionResult.valid) {
        return {
          status: 'invalid',
          validationPayload: { errors: ingestionResult.errors },
          errorCount: ingestionResult.errors.length
        };
      }

      return { status: 'ok' };
    } catch (error) {
      if (isValidationFailure(error)) {
        return {
          status: 'invalid',
          validationPayload: { error: toErrorMetadata(error) },
          errorCount: 1
        };
      }

      throw error;
    }
  });
}

/**
 * Finalize process stage by persisting invalid or ingested outcomes.
 *
 * @param {SubmissionUpload} submissionUpload Submission upload payload.
 * @param {string} jobId Job identifier.
 * @param {ProcessSubmissionFeaturesExecutionOutcome} outcome Execution outcome.
 * @returns {Promise<void>}
 */
async function finalizeProcessSubmissionFeaturesStage(
  submissionUpload: SubmissionUpload,
  jobId: string,
  outcome: ProcessSubmissionFeaturesExecutionOutcome
): Promise<void> {
  if (outcome.status === 'invalid') {
    await withConnection(async (connection) => {
      const submissionValidationService = new SubmissionValidationService(connection);
      const submissionUploadService = new SubmissionUploadService(connection);

      await submissionValidationService.updateSubmissionValidationStatus(jobId, 'invalid', outcome.validationPayload);
      await submissionUploadService.transitionSubmissionUploadToInvalid(submissionUpload.submission_upload_id);
    });

    defaultLog.warn({
      label: 'finalizeProcessSubmissionFeaturesStage',
      message: 'Submission validation failed during process stage',
      jobId,
      submissionUploadId: submissionUpload.submission_upload_id,
      submissionId: submissionUpload.submission_id,
      errorCount: outcome.errorCount
    });

    return;
  }

  await withConnection(async (connection) => {
    const submissionValidationService = new SubmissionValidationService(connection);
    const submissionUploadService = new SubmissionUploadService(connection);
    const uploadArchiveService = new UploadArchiveService(connection);

    await submissionValidationService.updateSubmissionValidationStatus(jobId, 'completed');
    await submissionUploadService.transitionSubmissionUploadToIngested(submissionUpload.submission_upload_id);

    await uploadArchiveService.updateUploadArchivesByUploadId(submissionUpload.upload_id, {
      archive_status: ProcessStatusStatusEnum.COMPLETED
    });
  });
}

/**
 * Publish downstream index work after ingested commit (best effort).
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<void>}
 */
async function executeIndexSubmissionFeaturesPublish(
  submissionId: number,
  submissionUploadId: string,
  jobId: string
): Promise<void> {
  try {
    await withConnection(async (connection) => {
      const publishStart = Date.now();
      const indexResult = await publishIndexSubmissionFeaturesJob(connection, {
        submissionId,
        submissionUploadId
      });

      const publishMetrics = {
        label: 'executeIndexSubmissionFeaturesPublish',
        message: 'Index submission publish attempt completed',
        jobId,
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
    });
  } catch (error) {
    defaultLog.warn({
      label: 'executeIndexSubmissionFeaturesPublish',
      message: 'Index submission publish failed after ingested commit; leaving status as ingested',
      jobId,
      submissionUploadId,
      submissionId,
      error: toErrorMetadata(error)
    });
  }
}

/**
 * Orchestrate process stage workflow phases.
 *
 * @param {PgBoss.Job<SubmissionUpload>} job Queue job payload.
 * @returns {Promise<void>}
 */
async function runProcessSubmissionFeaturesStage(job: PgBoss.Job<SubmissionUpload>): Promise<void> {
  const submissionUpload = job.data;
  const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

  const shouldProcess = await initializeProcessSubmissionFeaturesStage(submissionUploadId, job.id);
  if (!shouldProcess) {
    return;
  }

  const outcome = await executeProcessSubmissionFeaturesIngestion(submissionUpload, job.id);
  await finalizeProcessSubmissionFeaturesStage(submissionUpload, job.id, outcome);

  if (outcome.status === 'ok') {
    await executeIndexSubmissionFeaturesPublish(submissionId, submissionUploadId, job.id);
  }

  defaultLog.info({
    label: 'runProcessSubmissionFeaturesStage',
    message: 'Process submission features job completed successfully',
    jobId: job.id,
    submissionId,
    submissionUploadId
  });
}

/**
 * Process submission features job handler.
 *
 * @param {PgBoss.Job<SubmissionUpload>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processSubmissionFeaturesJobHandler: PgBoss.WorkHandler<SubmissionUpload> = async (jobs) => {
  for (const job of jobs) {
    const { submission_upload_id: submissionUploadId, submission_id: submissionId } = job.data;

    defaultLog.info({
      label: 'processSubmissionFeaturesJobHandler',
      message: 'Processing submission features job',
      jobId: job.id,
      submissionUploadId,
      submissionId
    });

    try {
      await runProcessSubmissionFeaturesStage(job);
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
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        error: toErrorMetadata(error)
      });

      throw error;
    }
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

    try {
      await withConnection(async (connection) => {
        const submissionValidationService = new SubmissionValidationService(connection);
        const submissionUploadService = new SubmissionUploadService(connection);

        await submissionValidationService.updateSubmissionValidationStatusBySubmissionUploadId(
          submissionUploadId,
          'failed',
          {
            error: jobOutput ?? 'Job failed after all retries'
          }
        );

        await submissionUploadService.transitionSubmissionUploadStatus(submissionUploadId, 'failed', [
          'uploaded',
          'ingesting',
          'ingested',
          'indexing'
        ]);
      });

      defaultLog.info({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed job status updated',
        jobId: job.id,
        submissionUploadId
      });
    } catch (error) {
      defaultLog.error({
        label: 'processSubmissionFeaturesFailedHandler',
        message: 'Failed to update failed job status',
        jobId: job.id,
        submissionUploadId,
        error
      });

      throw error;
    }
  }
};
