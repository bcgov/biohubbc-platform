import PgBoss from 'pg-boss';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { publishAutomaticSecurityScreeningJob } from '../publisher';
import { withConnection } from '../with-connection';

export interface ComputeSubmissionFeatureClosureJobDependencies {
  publishAutomaticSecurityScreeningJob: typeof publishAutomaticSecurityScreeningJob;
}

/**
 * Mutable dependency bag for the compute-submission-feature-closure job.
 *
 * Tests should stub this bag rather than the publisher module directly, since
 * named ESM exports are non-configurable.
 */
export const computeSubmissionFeatureClosureJobDependencies: ComputeSubmissionFeatureClosureJobDependencies = {
  publishAutomaticSecurityScreeningJob
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
        await computeSubmissionFeatureClosureJobDependencies.publishAutomaticSecurityScreeningJob(conn, {
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
 * The closure recompute is now a required leg of the upload lifecycle: it publishes the
 * automatic security screening job, which carries the upload to the terminal-success
 * `security_screened` status. A permanently failed closure would otherwise strand the
 * upload at the intermediate `indexed` status with no operator signal, so this handler
 * transitions the upload to `failed` (restartable — `failed` is a process-start status).
 * The closure data itself remains recoverable: re-running the pipeline regenerates it.
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

    await withConnection(async (connection) => {
      const submissionUploadService = new SubmissionUploadService(connection);
      // The closure job runs after the upload reached 'indexed' (set in the same transaction
      // that published this job); a failed run leaves it there. 'failed' allows idempotent
      // re-handling of the DLQ job itself. 'security_screened' covers a closure job queued
      // before the screening migration backfilled completed uploads to that status — its
      // closure is genuinely missing, so surfacing 'failed' is still correct.
      await submissionUploadService.transitionSubmissionUploadStatus(submissionUploadId, 'failed', [
        'indexed',
        'security_screened',
        'failed'
      ]);
    });

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
