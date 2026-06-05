import PgBoss from 'pg-boss';
import { INDEX_START_STATUSES, TERMINAL_UPLOAD_STATUSES } from '../../constants/submission-upload';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionFeaturePropertyValidationOutcome } from '../../services/ingestion/submission-feature-property-ingestion-service.interface';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

/**
 * Payload carried by each `index-submission-features` queue job.
 *
 * The pair `(submissionId, submissionUploadId)` defines:
 * - the submission-level scope used by indexing routines
 * - the exact upload lifecycle row whose status is guarded and transitioned
 */
export interface IIndexSubmissionFeaturesJobData {
  /** The submission ID whose features should be indexed for search */
  submissionId: number;
  /** The submission upload ID whose rows should be validated/indexed */
  submissionUploadId: string;
}

const defaultLog = getLogger('queue/jobs/index-submission-features-job');

/**
 * Determine whether an upload status is terminal for indexing purposes.
 *
 * Terminal statuses represent lifecycle completion where the index stage must not
 * run again for this upload (`indexed`, `invalid`, `failed`).
 *
 * @param {SubmissionUpload['status']} status Submission upload status.
 * @returns {boolean} `true` when the status is terminal and should short-circuit processing.
 */
function isTerminalSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return TERMINAL_UPLOAD_STATUSES.includes(status);
}

/**
 * Determine whether indexing is allowed to start or resume from the current status.
 *
 * Indexing is allowed only from:
 * - `ingested`: first entry into the indexing stage
 * - `indexing`: retry/resume of an interrupted indexing attempt
 *
 * @param {SubmissionUpload['status']} status Submission upload status.
 * @returns {boolean} `true` when indexing is permitted for the given status.
 */
function isIndexStartableSubmissionUploadStatus(status: SubmissionUpload['status']): boolean {
  return INDEX_START_STATUSES.includes(status);
}

/**
 * Guard and initialize the indexing stage for one upload.
 *
 * Workflow:
 * 1) Load the current upload lifecycle row.
 * 2) Skip when upload is already terminal.
 * 3) Skip when upload is not in an index-startable state.
 * 4) Transition lifecycle status to `indexing` before heavy work begins.
 *
 * This method is intentionally idempotent for retries: if a job is retried while
 * already `indexing`, the stage is allowed to proceed again.
 *
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<boolean>} `true` when indexing should proceed; `false` when skipped by guard checks.
 */
async function initializeIndexSubmissionFeaturesStage(submissionUploadId: string, jobId: string): Promise<boolean> {
  return withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);
    const currentUpload = await submissionUploadService.getSubmissionUpload(submissionUploadId);

    if (isTerminalSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.info({
        label: 'initializeIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is terminal',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return false;
    }

    if (!isIndexStartableSubmissionUploadStatus(currentUpload.status)) {
      defaultLog.warn({
        label: 'initializeIndexSubmissionFeaturesStage',
        message: 'Skipping index job because submission upload is not index-startable',
        jobId,
        submissionUploadId,
        status: currentUpload.status
      });
      return false;
    }

    await submissionUploadService.transitionSubmissionUploadToIndexing(submissionUploadId);
    return true;
  });
}

/**
 * Execute the core submission-property indexing and validation workload.
 *
 * This calls `SubmissionFeaturePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId(...)`
 * inside a DB connection scope and returns a normalized outcome describing whether
 * the upload is valid for indexing completion.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @returns {Promise<SubmissionFeaturePropertyValidationOutcome>} Structured indexing outcome used for final status transition.
 */
async function executeIndexSubmissionFeaturesIngestion(
  submissionId: number,
  submissionUploadId: string
): Promise<SubmissionFeaturePropertyValidationOutcome> {
  return withConnection(async (connection) => {
    const featurePropertyIngestionService = new SubmissionFeaturePropertyIngestionService(connection);
    return featurePropertyIngestionService.indexSubmissionPropertiesBySubmissionUploadId(
      submissionId,
      submissionUploadId
    );
  });
}

/**
 * Finalize lifecycle status based on indexing outcome and emit completion logs.
 *
 * Outcome handling:
 * - `invalid`: mark upload `invalid` and log validation counts
 * - otherwise: mark upload `indexed`
 *
 * This is the stage-commit step after heavy indexing work has finished.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @param {SubmissionFeaturePropertyValidationOutcome} outcome Indexing outcome.
 * @returns {Promise<void>}
 */
async function finalizeIndexSubmissionFeaturesStage(
  submissionId: number,
  submissionUploadId: string,
  jobId: string,
  outcome: SubmissionFeaturePropertyValidationOutcome
): Promise<void> {
  await withConnection(async (connection) => {
    const submissionUploadService = new SubmissionUploadService(connection);

    if (outcome.status === 'invalid') {
      await submissionUploadService.transitionSubmissionUploadToInvalid(submissionUploadId);

      defaultLog.warn({
        label: 'finalizeIndexSubmissionFeaturesStage',
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
      label: 'finalizeIndexSubmissionFeaturesStage',
      message: 'Index submission features job completed successfully',
      jobId,
      submissionId,
      submissionUploadId
    });
  });
}

/**
 * Orchestrate the complete indexing stage for one queue item.
 *
 * Stage order:
 * 1) initialize/guard
 * 2) execute indexing
 * 3) finalize lifecycle status
 *
 * If initialization returns `false`, processing is intentionally skipped without error.
 *
 * @param {number} submissionId Submission scope.
 * @param {string} submissionUploadId Submission upload scope.
 * @param {string} jobId Job identifier.
 * @returns {Promise<void>}
 */
async function runIndexSubmissionFeaturesStage(
  submissionId: number,
  submissionUploadId: string,
  jobId: string
): Promise<void> {
  const shouldRun = await initializeIndexSubmissionFeaturesStage(submissionUploadId, jobId);
  if (!shouldRun) {
    return;
  }

  const outcome = await executeIndexSubmissionFeaturesIngestion(submissionId, submissionUploadId);
  await finalizeIndexSubmissionFeaturesStage(submissionId, submissionUploadId, jobId, outcome);
}

/**
 * Primary pg-boss worker handler for `index-submission-features`.
 *
 * For each dequeued job:
 * - log job context
 * - run the indexing stage orchestrator
 * - on unexpected failure, rethrow so pg-boss retry policy applies. Terminal
 *   `failed` state is persisted by the DLQ handler after retries are exhausted.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs Batched jobs provided by pg-boss.
 * @returns {Promise<void>}
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
      defaultLog.error({
        label: 'indexSubmissionFeaturesJobHandler',
        message: 'Index submission features job failed',
        jobId: job.id,
        submissionId,
        submissionUploadId,
        error
      });

      // Rethrow so pg-boss can apply configured retries.
      // Final terminal status ('failed') is persisted by the DLQ handler once retries are exhausted.
      throw error;
    }
  }
};

/**
 * Dead-letter handler for jobs that exhausted all retry attempts.
 *
 * This handler runs after queue retries are exhausted. It persists terminal
 * `failed` lifecycle state and emits operational logs with final job metadata.
 *
 * @param {PgBoss.Job<IIndexSubmissionFeaturesJobData>[]} jobs Failed jobs moved to the DLQ.
 * @returns {Promise<void>}
 */
export const indexSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IIndexSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IIndexSubmissionFeaturesJobData>).output;

    await withConnection(async (connection) => {
      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.transitionSubmissionUploadStatus(submissionUploadId, 'failed', [
        'ingested',
        'indexing',
        'failed'
      ]);
    });

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
