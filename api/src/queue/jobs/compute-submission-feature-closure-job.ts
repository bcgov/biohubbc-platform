import PgBoss from 'pg-boss';
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
 * The `submissionUploadId` scopes the recompute; `submissionId` is carried for log context only.
 */
export interface IComputeSubmissionFeatureClosureJobData {
  /** The submission ID whose upload's closure is being recomputed (log context) */
  submissionId: number;
  /** The submission upload ID whose closure rows should be recomputed */
  submissionUploadId: string;
}

/**
 * Compute submission feature closure job handler.
 *
 * The closure is the precomputed directed reachability over the union of an upload's parent and
 * property (feature-reference) edges. It is recomputed wholesale for one upload so search can replace
 * recursive edge traversal with indexed probes against a flat `(source, target)` table. Content edges
 * are intentionally excluded (parent + content is O(N^2)). Reachability is stored as directed
 * `(source, target)` rows probed in both directions: the `(source, target)` primary key serves the
 * forward probe (what an evidence feature reaches), and the secondary `(target, source)` index serves
 * search's reverse "who reaches Y" down-probe.
 *
 * Each upload's recompute is single-flight: a `pg_try_advisory_xact_lock` keyed on the upload id guards
 * the DELETE-all + recursive-CTE INSERT, so an expiry-retry that overlaps its own still-running original
 * skips rather than contending. On failure the handler logs and rethrows so pg-boss applies its retry
 * policy — the recompute is idempotent (it deletes the upload's prior closure rows before reinserting),
 * so a retry is safe.
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
        // Single-flight per upload — the recompute is DELETE-all + recursive-CTE INSERT in one
        // transaction. An expiry-retry overlapping its own still-running original would contend/corrupt.
        // xact-scoped advisory lock (distinct seed from indexing); skip if another recompute holds it.
        const lock = await conn.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 1)) AS locked', [
          submissionUploadId
        ]);
        if (!lock.rows[0].locked) {
          defaultLog.warn({
            label: 'computeSubmissionFeatureClosureJobHandler',
            message: 'another closure recompute holds the advisory lock for this upload; skipping',
            jobId: job.id,
            submissionId,
            submissionUploadId
          });
          return;
        }

        const result = await new SubmissionFeatureClosureService(conn).computeClosureForUpload(submissionUploadId);

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
