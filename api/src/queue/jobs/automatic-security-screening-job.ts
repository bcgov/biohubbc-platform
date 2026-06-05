import PgBoss from 'pg-boss';
import { AutomaticSecurityScreeningService } from '../../services/automatic-security-screening-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/automatic-security-screening-job');

/**
 * Automatic security screening job data interface.
 *
 * The `submissionUploadId` scopes the screening run; `submissionId` is carried
 * for log context only.
 */
export interface IAutomaticSecurityScreeningJobData {
  /** The submission ID whose upload is being screened (log context only) */
  submissionId: number;
  /** The submission upload ID to evaluate active security rules against */
  submissionUploadId: string;
}

/**
 * Automatic security screening job handler.
 *
 * Evaluates all active (`is_active = true`, non-soft-deleted) security rules against the
 * active features of the target `submission_upload`. For each rule, the policy evaluator
 * seam identifies trigger `submission_feature_id` values; the screening service then
 * uses `submission_feature_closure` to find related features in the same upload and
 * inserts draft `submission_feature_security` rows for all of them.
 *
 * Status lifecycle managed by this job:
 *   `indexed` → `security_screening` → `security_screened`
 *
 * **Single-flight:** A `pg_try_advisory_xact_lock` keyed on the upload id (distinct hash
 * seed from the closure job) prevents two concurrent screening jobs for the same upload
 * from racing. An overlapping retry that cannot acquire the lock skips the run and
 * returns cleanly — pg-boss will not retry a successfully-completed job.
 *
 * **Idempotency:** The repository insert uses `ON CONFLICT DO NOTHING`, so rerunning
 * screening for the same upload produces no duplicate rows (AC10).
 *
 * @param {PgBoss.Job<IAutomaticSecurityScreeningJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const automaticSecurityScreeningJobHandler: PgBoss.WorkHandler<IAutomaticSecurityScreeningJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    defaultLog.info({
      label: 'automaticSecurityScreeningJobHandler',
      message: 'Processing automatic security screening job',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });

    try {
      await withConnection(async (conn) => {
        // Single-flight per upload — screening transitions status and bulk-inserts draft rows.
        // Hash seed 2 is distinct from the closure job's seed (1) so both locks can coexist
        // when both jobs happen to run in the same transaction context.
        const lock = await conn.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 2)) AS locked', [
          submissionUploadId
        ]);
        if (!lock.rows[0].locked) {
          defaultLog.warn({
            label: 'automaticSecurityScreeningJobHandler',
            message: 'Another screening job holds the advisory lock for this upload; skipping',
            jobId: job.id,
            submissionId,
            submissionUploadId
          });
          return;
        }

        await new AutomaticSecurityScreeningService(conn).screenSubmissionUpload(submissionUploadId, submissionId);
      });

      defaultLog.info({
        label: 'automaticSecurityScreeningJobHandler',
        message: 'Automatic security screening job completed successfully',
        jobId: job.id,
        submissionId,
        submissionUploadId
      });
    } catch (error) {
      defaultLog.error({
        label: 'automaticSecurityScreeningJobHandler',
        message: 'Automatic security screening job failed',
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
 * Dead Letter Queue handler for failed automatic security screening jobs.
 *
 * Screening produces only draft rows (no access restrictions, no data loss if
 * stale) and the job is idempotent, so a future re-enqueue (e.g. re-indexing)
 * will regenerate the records. This handler only logs the failure and does not
 * change the upload's lifecycle status.
 *
 * @param {PgBoss.Job<IAutomaticSecurityScreeningJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const automaticSecurityScreeningFailedHandler: PgBoss.WorkHandler<IAutomaticSecurityScreeningJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    const jobOutput = (job as PgBoss.JobWithMetadata<IAutomaticSecurityScreeningJobData>).output;

    defaultLog.warn({
      label: 'automaticSecurityScreeningFailedHandler',
      message: 'Automatic security screening job failed after all retries',
      jobId: job.id,
      submissionId,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
