import PgBoss from 'pg-boss';
import {
  SUBMISSION_ACTIVE_STATE_LOCK_PREFIX,
  SUBMISSION_ACTIVE_STATE_LOCK_SEED
} from '../../constants/database-lock-keys';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
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
 * `submissionUploadId` identifies the upload that triggered the work. The handler resolves the
 * authoritative submission ID from that upload before recomputing submission-wide closure.
 */
export interface IComputeSubmissionFeatureClosureJobData {
  /** The submission upload ID that triggered the recompute (forwarded to screening) */
  submissionUploadId: string;
}

/**
 * Compute submission feature closure job handler.
 *
 * The closure is the precomputed directed reachability over the union of the submission's parent and
 * property (feature-reference) edges, spanning the submission's live rows across all uploads.
 * Successive uploads create new physical occurrences, so cross-upload edges are part of the reach.
 * It is recomputed wholesale so search can replace recursive edge traversal with indexed probes
 * against a flat `(source, target)` table. Content edges are intentionally excluded (parent + content
 * is O(N^2)). Reachability is stored as directed `(source, target)` rows probed in both directions:
 * the `(source, target)` primary key serves the forward probe (what an evidence feature reaches), and
 * the secondary `(target, source)` index serves search's reverse "who reaches Y" down-probe.
 *
 * Each submission's recompute takes the shared blocking active-state lock. A job waits for an
 * overlapping recompute or upload activation instead of being acknowledged without publishing its
 * upload-specific security-screening job. On failure the handler logs and rethrows so pg-boss
 * applies its retry policy — the recompute is idempotent (it deletes the submission's prior closure
 * rows before reinserting), so a retry is safe.
 *
 * @param {PgBoss.Job<IComputeSubmissionFeatureClosureJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const computeSubmissionFeatureClosureJobHandler: PgBoss.WorkHandler<
  IComputeSubmissionFeatureClosureJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { submissionUploadId } = job.data;

    defaultLog.info({
      label: 'computeSubmissionFeatureClosureJobHandler',
      message: 'Processing compute submission feature closure job',
      jobId: job.id,
      submissionUploadId
    });

    try {
      await withConnection(async (connection) => {
        const submissionUploadService = new SubmissionUploadService(connection);
        const upload = await submissionUploadService.getSubmissionUpload(submissionUploadId);
        const submissionId = upload.submission_id;
        // The recompute is DELETE-all + recursive-CTE INSERT in one transaction. Wait for every
        // feature-state writer; every upload must reach the downstream security job.
        await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, $3))", [
          SUBMISSION_ACTIVE_STATE_LOCK_PREFIX,
          submissionId,
          SUBMISSION_ACTIVE_STATE_LOCK_SEED
        ]);

        const submissionFeatureClosureService = new SubmissionFeatureClosureService(connection);
        const result = await submissionFeatureClosureService.computeClosureForSubmission(submissionId);

        // Anchor writers may have skipped this submission while closure was invalidated. Queue the
        // existing derived-cache refresh only after the resolved graph has been rebuilt successfully.
        const securityScopeService = new SecurityScopeService(connection);
        await securityScopeService.triggerAnchorComputationForSubmission(submissionId);

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
        await computeSubmissionFeatureClosureJobDependencies.publishSubmissionUploadSecurityJob(connection, {
          submissionId,
          submissionUploadId
        });
      });
    } catch (error) {
      defaultLog.error({
        label: 'computeSubmissionFeatureClosureJobHandler',
        message: 'Compute submission feature closure job failed',
        jobId: job.id,
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
    const { submissionUploadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IComputeSubmissionFeatureClosureJobData>).output;

    defaultLog.warn({
      label: 'computeSubmissionFeatureClosureFailedHandler',
      message: 'Compute submission feature closure job failed after all retries',
      jobId: job.id,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
