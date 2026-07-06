import PgBoss from 'pg-boss';
import {
  SUBMISSION_ACTIVE_STATE_LOCK_PREFIX,
  SUBMISSION_ACTIVE_STATE_LOCK_SEED
} from '../../constants/database-lock-keys';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { getLogger } from '../../utils/logger';
import { publishSubmissionUploadSecurityJob } from '../publisher';
import { withConnection } from '../with-connection';

export interface ComputeSubmissionFeatureClosureJobDependencies {
  publishSubmissionUploadSecurityJob: typeof publishSubmissionUploadSecurityJob;
}

/**
 * Mutable dependency bag for the compute-submission-feature-closure job.
 *
 * Tests should stub this bag rather than the publisher module directly, since
 * named ESM exports are non-configurable.
 */
export const computeSubmissionFeatureClosureJobDependencies: ComputeSubmissionFeatureClosureJobDependencies = {
  publishSubmissionUploadSecurityJob
};

const defaultLog = getLogger('queue/jobs/compute-submission-feature-closure-job');

/**
 * Compute submission feature closure job data interface.
 *
 * The `submissionId` scopes the recompute (closure spans the submission's live rows across all
 * uploads); `submissionUploadId` identifies the upload that triggered it and is forwarded to the
 * downstream security screening job.
 */
export interface IComputeSubmissionFeatureClosureJobData {
  /** The submission ID whose closure rows should be recomputed */
  submissionId: number;
  /** The submission upload ID that triggered the recompute (forwarded to screening) */
  submissionUploadId: string;
}

/**
 * Compute submission feature closure job handler.
 *
 * The closure is the precomputed directed reachability over the union of the submission's parent and
 * property (feature-reference) edges, spanning the submission's live rows across ALL uploads
 * (reconciled uploads only carry new/changed features, so cross-upload edges are part of the reach).
 * It is recomputed wholesale so search can replace recursive edge traversal with indexed probes
 * against a flat `(source, target)` table. Content edges are intentionally excluded (parent + content
 * is O(N^2)). Reachability is stored as directed `(source, target)` rows probed in both directions:
 * the `(source, target)` primary key serves the forward probe (what an evidence feature reaches), and
 * the secondary `(target, source)` index serves search's reverse "who reaches Y" down-probe.
 *
 * Each submission's recompute is single-flight: a `pg_try_advisory_xact_lock` on the shared
 * per-submission active-state key guards the DELETE-all + recursive-CTE INSERT, so an expiry-retry
 * that overlaps its own still-running original skips rather than contending. Upload activation
 * (reconciliation at approval) takes the blocking form of the same lock and recomputes the closure
 * itself, so skipping while an activation holds the lock is also correct. On failure the handler logs
 * and rethrows so pg-boss applies its retry policy — the recompute is idempotent (it deletes the
 * submission's prior closure rows before reinserting), so a retry is safe.
 *
 * @param {PgBoss.Job<IComputeSubmissionFeatureClosureJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const computeSubmissionFeatureClosureJobHandler: PgBoss.WorkHandler<
  IComputeSubmissionFeatureClosureJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    defaultLog.info({
      label: 'computeSubmissionFeatureClosureJobHandler',
      message: 'Processing compute submission feature closure job',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });

    try {
      await withConnection(async (conn) => {
        // Single-flight per submission — the recompute is DELETE-all + recursive-CTE INSERT in one
        // transaction. An expiry-retry overlapping its own still-running original would contend/corrupt.
        // xact-scoped advisory lock on the shared per-submission active-state key; skip if another
        // recompute (or an upload activation, which recomputes the closure itself) holds it.
        const lock = await conn.query(
          "SELECT pg_try_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, $3)) AS locked",
          [SUBMISSION_ACTIVE_STATE_LOCK_PREFIX, submissionId, SUBMISSION_ACTIVE_STATE_LOCK_SEED]
        );
        if (!lock.rows[0].locked) {
          defaultLog.warn({
            label: 'computeSubmissionFeatureClosureJobHandler',
            message: 'another writer holds the active-state advisory lock for this submission; skipping',
            jobId: job.id,
            submissionId,
            submissionUploadId
          });
          return;
        }

        const result = await new SubmissionFeatureClosureService(conn).computeClosureForSubmission(submissionId);

        defaultLog.info({
          label: 'computeSubmissionFeatureClosureJobHandler',
          message: 'Compute submission feature closure job completed successfully',
          jobId: job.id,
          submissionId,
          submissionUploadId,
          insertedCount: result.insertedCount
        });

        // Enqueue screening in the same transaction as the closure write so the job
        // is only visible if the closure rows commit. This guarantees AC1: screening
        // never starts before closure population is complete.
        await computeSubmissionFeatureClosureJobDependencies.publishSubmissionUploadSecurityJob(conn, {
          submissionId,
          submissionUploadId
        });
      });
    } catch (error) {
      defaultLog.error({
        label: 'computeSubmissionFeatureClosureJobHandler',
        message: 'Compute submission feature closure job failed',
        jobId: job.id,
        submissionId,
        submissionUploadId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    }
  }
};

/**
 * Dead Letter Queue handler for failed compute submission feature closure jobs.
 *
 * Closure is a derived index recomputed wholesale per upload; `indexed` remains the
 * terminal-success status and automatic security screening is an independent background
 * workflow, so a permanently failed closure does not change the upload's status. The
 * closure data itself remains recoverable: re-running the pipeline regenerates it. This
 * handler therefore only logs the exhausted-retry event for operator visibility.
 *
 * @param {PgBoss.Job<IComputeSubmissionFeatureClosureJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const computeSubmissionFeatureClosureFailedHandler: PgBoss.WorkHandler<
  IComputeSubmissionFeatureClosureJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IComputeSubmissionFeatureClosureJobData>).output;

    defaultLog.warn({
      label: 'computeSubmissionFeatureClosureFailedHandler',
      message: 'Compute submission feature closure job failed after all retries',
      jobId: job.id,
      submissionId,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
