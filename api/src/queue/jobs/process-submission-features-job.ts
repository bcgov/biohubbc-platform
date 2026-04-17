import PgBoss from 'pg-boss';
import { PROCESS_START_STATUSES, TERMINAL_UPLOAD_STATUSES } from '../../constants/submission-upload';
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
import { ProcessSubmissionFeaturesExecutionOutcome } from './process-submission-features-job.interface';

const defaultLog = getLogger('queue/jobs/process-submission-features-job');

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
 * Initialize process-stage preconditions and record stage start.
 *
 * Flow:
 * - Read current submission-upload status to decide whether this job should run.
 * - Exit early for terminal/non-startable statuses to avoid duplicate or invalid transitions.
 * - Transition upload to `ingesting` in its own transaction.
 * - Mark validation record as `started` in its own transaction.
 *
 * Each phase uses a short-lived `withConnection` so progress is committed incrementally.
 * This keeps transaction lifetimes bounded and preserves partial progress across retries.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<boolean>} True when stage should proceed.
 */
async function initializeProcessSubmissionFeaturesStage(submissionUploadId: string, jobId: string): Promise<boolean> {
  // Step 1: Load current upload status for guard checks.
  const currentUpload = await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    return submissionUploadService.getSubmissionUpload(submissionUploadId);
  });

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

  // Step 2: Persist stage entry on upload row.
  await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    await submissionUploadService.transitionSubmissionUploadToIngesting(submissionUploadId);
  });

  // Step 3: Persist validation start marker for the current job.
  await withConnection(async (connection) => {
    const submissionValidationService = new SubmissionValidationService(connection);
    await submissionValidationService.updateSubmissionValidationStatus(jobId, 'started');
  });

  return true;
}

/**
 * Execute ingestion and normalize ingest results into process-stage outcomes.
 *
 * Flow:
 * - Run ingestion in a bounded transaction.
 * - Return `ok` when ingest succeeds.
 * - Map validation-shaped ingest failures into `invalid` outcomes (non-retryable business failure).
 * - Re-throw unexpected/system errors so pg-boss retries the job.
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
    // This transaction encapsulates archive ingestion and any DB writes performed by the ingestion service.
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
 * Finalize process-stage state transitions based on ingestion outcome.
 *
 * Branches on normalized outcome:
 *
 * - **Invalid**:
 *   - Persist validation record as `invalid`.
 *   - Transition upload to invalid state.
 *
 * - **Ok**:
 *   - Persist validation record as `completed`.
 *   - Transition upload to `ingested`.
 *   - Mark upload archive process status as `COMPLETED`.
 *
 * Each write is committed in its own `withConnection` so partial progress survives retries.
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
    // Step 1a: Record validation failure payload for observability.
    await withConnection(async (connection) => {
      const submissionValidationService = new SubmissionValidationService(connection);
      await submissionValidationService.updateSubmissionValidationStatus(jobId, 'invalid', outcome.validationPayload);
    });

    // Step 1b: Move submission upload to invalid terminal state.
    await withConnection(async (connection) => {
      const submissionUploadService = new SubmissionUploadService(connection);
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

  // Step 2a: Mark validation stage as completed.
  await withConnection(async (connection) => {
    const submissionValidationService = new SubmissionValidationService(connection);
    await submissionValidationService.updateSubmissionValidationStatus(jobId, 'completed', outcome.validationPayload);
  });

  // Step 2b: Move submission upload into post-ingest state.
  await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    await submissionUploadService.transitionSubmissionUploadToIngested(submissionUpload.submission_upload_id);
  });

  // Step 2c: Mark archive processing status complete for downstream visibility.
  await withConnection(async (connection) => {
    const uploadArchiveService = new UploadArchiveService(connection);
    await uploadArchiveService.updateUploadArchivesByUploadId(submissionUpload.upload_id, {
      archive_status: ProcessStatusStatusEnum.COMPLETED
    });
  });
}

/**
 * Publish downstream index work.
 *
 * This step is intentionally isolated in its own transaction boundary:
 * - If enqueue fails, the process job throws and is retried by pg-boss.
 * - Because earlier phases are already committed, retries resume from persisted state.
 *
 * Index publish is required for successful process-stage completion.
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
  await withConnection(async (connection) => {
    // Enqueue downstream indexing and treat enqueue failures as retryable job failures.
    const publishStart = Date.now();
    const indexResult = await publishIndexSubmissionFeaturesJob(connection, { submissionId });

    if (indexResult.status === 'error') {
      defaultLog.error({
        label: 'executeIndexSubmissionFeaturesPublish',
        message: 'Index submission publish failed',
        jobId,
        submissionUploadId,
        submissionId,
        elapsedMs: Date.now() - publishStart,
        indexResult
      });
      throw new Error(`Index submission publish failed: ${indexResult.message}`);
    }

    defaultLog.info({
      label: 'executeIndexSubmissionFeaturesPublish',
      message: 'Index submission publish completed',
      jobId,
      submissionUploadId,
      submissionId,
      elapsedMs: Date.now() - publishStart,
      indexResult
    });
  });
}

/**
 * Orchestrate process stage workflow phases.
 *
 * Pipeline:
 * - Initialize stage guards + start markers.
 * - Execute archive ingestion.
 * - Publish downstream indexing when ingestion succeeds.
 * - Finalize upload/validation/archive statuses.
 *
 * Each phase is delegated to methods that commit through short-lived `withConnection`
 * blocks to preserve partial progress and keep transactions bounded.
 *
 * @param {PgBoss.Job<SubmissionUpload>} job Queue job payload.
 * @returns {Promise<void>}
 */
async function runProcessSubmissionFeaturesStage(job: PgBoss.Job<SubmissionUpload>): Promise<void> {
  const submissionUpload = job.data;
  const { submission_upload_id: submissionUploadId, submission_id: submissionId } = submissionUpload;

  // Resolve stage eligibility and mark process stage as started.
  const shouldProcess = await initializeProcessSubmissionFeaturesStage(submissionUploadId, job.id);
  if (!shouldProcess) {
    return;
  }

  // Perform archive ingestion and map validation outcomes.
  const outcome = await executeProcessSubmissionFeaturesIngestion(submissionUpload, job.id);

  if (outcome.status === 'ok') {
    // Indexing enqueue is required; if enqueue fails, process-stage completion must retry.
    await executeIndexSubmissionFeaturesPublish(submissionId, submissionUploadId, job.id);
  }

  // Persist final process-stage status transitions.
  await finalizeProcessSubmissionFeaturesStage(submissionUpload, job.id, outcome);

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
 * Responsibilities:
 * - Iterate pg-boss batch jobs.
 * - Run the process-stage orchestrator per job.
 * - Re-throw on failure so pg-boss applies configured retries.
 *
 * Final terminal `failed` status is intentionally deferred to the DLQ handler after retries are exhausted.
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

    try {
      await runProcessSubmissionFeaturesStage(job);
    } catch (error) {
      defaultLog.error({
        label: 'processSubmissionFeaturesJobHandler',
        message: 'Process submission features job failed; allowing pg-boss retry',
        jobId: job.id,
        submissionUploadId,
        submissionId,
        error: toErrorMetadata(error)
      });

      // Rethrow so pg-boss can apply configured retries.
      // Final terminal status ('failed') is persisted by the DLQ handler once retries are exhausted.
      throw error;
    }
  }
};

/**
 * Dead Letter Queue handler for failed process submission features jobs.
 *
 * Runs only after pg-boss retry policy is exhausted.
 *
 * Steps:
 * - Persist validation status as `failed` using submission-upload scope.
 * - Transition submission upload status to `failed`.
 *
 * Each write is isolated in its own `withConnection` to keep transaction duration short
 * and maximize durability of partial progress even if a later write fails.
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

        await submissionValidationService.updateSubmissionValidationStatusBySubmissionUploadId(
          submissionUploadId,
          'failed',
          {
            error: jobOutput ?? 'Job failed after all retries'
          }
        );
      });

      await withConnection(async (connection) => {
        const submissionUploadService = new SubmissionUploadService(connection);
        await submissionUploadService.transitionSubmissionUploadStatus(submissionUploadId, 'failed', [
          'uploaded',
          'ingesting',
          'ingested',
          'indexing',
          'failed'
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
