import PgBoss from 'pg-boss';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/submission-upload-security-job');

/**
 * Submission upload security (automatic screening) job data interface.
 *
 * The `submissionUploadId` scopes the screening run; `submissionId` is the upload's owning
 * submission, read from the locked upload row when indexing queues the job.
 */
export interface ISubmissionUploadSecurityJobData {
  /** The submission that owns the upload; the boundary for its review and feature matching */
  submissionId: number;
  /** The submission upload ID to evaluate active security rules against */
  submissionUploadId: string;
}

/**
 * Submission upload security job handler.
 *
 * Runs automatic security screening as an independent background workflow — it does NOT change
 * `submission_upload.status`. The screening lifecycle is recorded as an event row in
 * `submission_upload_security` (`started` → `completed`). Each screenable rule's active expressions
 * select matching features within the upload, following its parent and feature-reference relationships
 * without published closure, and the service inserts immediately effective `submission_feature_security`
 * rows linked to the scan event.
 *
 * **Single-flight:** A `pg_try_advisory_xact_lock` keyed on the upload id (distinct hash seed from
 * the closure job) prevents two concurrent screening jobs for the same upload from racing. An
 * overlapping retry that cannot acquire the lock skips the run and returns cleanly.
 *
 * **Idempotency:** Existing current assignments retain their provenance. Inactive assignments
 * become effective again, and repeated screening produces no duplicate feature/rule pairs.
 *
 * @param {PgBoss.Job<ISubmissionUploadSecurityJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const submissionUploadSecurityJobHandler: PgBoss.WorkHandler<ISubmissionUploadSecurityJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    defaultLog.info({
      label: 'submissionUploadSecurityJobHandler',
      message: 'Processing submission upload security job',
      jobId: job.id,
      submissionId,
      submissionUploadId
    });

    try {
      await withConnection(async (conn) => {
        // Single-flight per upload — screening inserts a scan event row and inserts current assignments.
        // Hash seed 2 is reserved for screening (see constants/database-lock-keys.ts), so this lock never
        // contends with the closure or active-state locks.
        const lock = await conn.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, 2)) AS locked', [
          submissionUploadId
        ]);
        if (!lock.rows[0].locked) {
          defaultLog.warn({
            label: 'submissionUploadSecurityJobHandler',
            message: 'Another screening job holds the advisory lock for this upload; skipping',
            jobId: job.id,
            submissionId,
            submissionUploadId
          });
          return;
        }

        // Screening evaluates every rule's evidence walks in one statement. Its estimated cost clears jit_above_cost
        // with only a few rules, and compiling it takes about a second for work that is index probes, which
        // compilation does not speed up. SET LOCAL keeps the setting to this job's transaction.
        await conn.query('SET LOCAL jit = off');

        const submissionUploadSecurityService = new SubmissionUploadSecurityService(conn);
        await submissionUploadSecurityService.screenSubmissionUpload(submissionUploadId, submissionId, job.id);
      });

      defaultLog.info({
        label: 'submissionUploadSecurityJobHandler',
        message: 'Submission upload security job completed successfully',
        jobId: job.id,
        submissionId,
        submissionUploadId
      });
    } catch (error) {
      defaultLog.error({
        label: 'submissionUploadSecurityJobHandler',
        message: 'Submission upload security job failed',
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
 * Dead Letter Queue handler for failed submission upload security jobs.
 *
 * Records a `failed` `submission_upload_security` event row for operator visibility. Screening is
 * independent of the upload lifecycle, so this does NOT change `submission_upload.status`. Each
 * failed attempt runs in a single transaction that rolls back on error, leaving no partial rows.
 *
 * @param {PgBoss.Job<ISubmissionUploadSecurityJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const submissionUploadSecurityFailedHandler: PgBoss.WorkHandler<ISubmissionUploadSecurityJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionId, submissionUploadId } = job.data;

    const jobOutput = (job as PgBoss.JobWithMetadata<ISubmissionUploadSecurityJobData>).output;

    await withConnection(async (connection) => {
      const submissionUploadSecurityService = new SubmissionUploadSecurityService(connection);
      await submissionUploadSecurityService.recordSubmissionUploadSecurityFailure(
        submissionUploadId,
        submissionId,
        job.id
      );
    });

    defaultLog.warn({
      label: 'submissionUploadSecurityFailedHandler',
      message: 'Submission upload security job failed after all retries',
      jobId: job.id,
      submissionId,
      submissionUploadId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
