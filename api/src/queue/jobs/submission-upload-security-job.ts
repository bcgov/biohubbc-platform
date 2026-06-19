import PgBoss from 'pg-boss';
import { SubmissionUploadSecurityService } from '../../services/submission-upload-security-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/submission-upload-security-job');

/**
 * Submission upload security (automatic screening) job data interface.
 *
 * The `submissionUploadId` scopes the screening run; `submissionId` is carried
 * for log context only.
 */
export interface ISubmissionUploadSecurityJobData {
  /** The submission ID whose upload is being screened (log context only) */
  submissionId: number;
  /** The submission upload ID to evaluate active security rules against */
  submissionUploadId: string;
}

/**
 * Submission upload security job handler.
 *
 * Runs automatic security screening as an independent background workflow — it does NOT change
 * `submission_upload.status`. The screening lifecycle is recorded as an event row in
 * `submission_upload_security` (`started` → `completed`). For each screenable rule the policy
 * evaluator seam identifies trigger `submission_feature_id` values; the service then uses
 * `submission_feature_closure` to find related features in the same upload and inserts draft
 * `submission_feature_security` rows linked to the scan event.
 *
 * **Single-flight:** A `pg_try_advisory_xact_lock` keyed on the upload id (distinct hash seed from
 * the closure job) prevents two concurrent screening jobs for the same upload from racing. An
 * overlapping retry that cannot acquire the lock skips the run and returns cleanly.
 *
 * **Idempotency:** The draft insert uses `ON CONFLICT DO NOTHING`, so rerunning screening for the
 * same upload produces no duplicate rows.
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
        // Single-flight per upload — screening inserts a scan event row and bulk-inserts draft rows.
        // Hash seed 2 is distinct from the closure job's seed (1) so both locks can coexist
        // when both jobs happen to run in the same transaction context.
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

        await new SubmissionUploadSecurityService(conn).screenSubmissionUpload(
          submissionUploadId,
          submissionId,
          job.id
        );
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
      await new SubmissionUploadSecurityService(connection).recordScreeningFailure(submissionUploadId, job.id);
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
