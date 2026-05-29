import PgBoss from 'pg-boss';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/rebuild-submission-feature-closure-job');

/**
 * Rebuild submission feature closure job data interface.
 *
 * The `submissionUploadId` scopes the rebuild; `submissionId` is carried for log context only.
 */
export interface IRebuildSubmissionFeatureClosureJobData {
  /** The submission ID whose upload's closure is being rebuilt (log context) */
  submissionId: number;
  /** The submission upload ID whose closure rows should be rebuilt */
  submissionUploadId: string;
}

/**
 * Rebuild submission feature closure job handler.
 *
 * The closure is the precomputed directed reachability over the union of an upload's parent,
 * content, and property edges. It is rebuilt wholesale for one upload so search can replace
 * recursive edge traversal with two indexed probes against a flat `(source, target)` table.
 *
 * On failure the handler logs and rethrows so pg-boss applies its retry policy — the rebuild is
 * idempotent (it deletes the upload's prior closure rows before reinserting), so a retry is safe.
 *
 * @param {PgBoss.Job<IRebuildSubmissionFeatureClosureJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const rebuildSubmissionFeatureClosureJobHandler: PgBoss.WorkHandler<
  IRebuildSubmissionFeatureClosureJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    defaultLog.info({
      label: 'rebuildSubmissionFeatureClosureJobHandler',
      message: 'Processing rebuild submission feature closure job',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });

    try {
      await withConnection(async (conn) => {
        const result = await new SubmissionFeatureClosureService(conn).rebuildClosureForUpload(submissionUploadId);

        defaultLog.info({
          label: 'rebuildSubmissionFeatureClosureJobHandler',
          message: 'Rebuild submission feature closure job completed successfully',
          jobId: job.id,
          submissionId,
          submissionUploadId,
          insertedCount: result.insertedCount
        });
      });
    } catch (error) {
      defaultLog.error({
        label: 'rebuildSubmissionFeatureClosureJobHandler',
        message: 'Rebuild submission feature closure job failed',
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
 * Dead Letter Queue handler for failed rebuild submission feature closure jobs.
 *
 * The closure is derived data — a stale closure for one upload is recoverable by re-enqueueing the
 * job (the next successful indexing run, or a manual rebuild, regenerates it). The upload's own
 * lifecycle status reflects indexing, not closure state, so this handler only logs the failure and
 * does not flip the upload's status.
 *
 * @param {PgBoss.Job<IRebuildSubmissionFeatureClosureJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const rebuildSubmissionFeatureClosureFailedHandler: PgBoss.WorkHandler<
  IRebuildSubmissionFeatureClosureJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IRebuildSubmissionFeatureClosureJobData>).output;

    defaultLog.warn({
      label: 'rebuildSubmissionFeatureClosureFailedHandler',
      message: 'Rebuild submission feature closure job failed after all retries',
      jobId: job.id,
      submissionId,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
