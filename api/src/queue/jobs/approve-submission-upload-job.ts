import PgBoss from 'pg-boss';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/approve-submission-upload-job');

/**
 * Approve submission upload job data interface.
 */
export interface IApproveSubmissionUploadJobData {
  /** The submission upload whose recorded approval is applied */
  submissionUploadId: string;
}

/**
 * Approve submission upload job handler.
 *
 * Applies an approval an administrator recorded as `approving`: activates the upload's reconciled features,
 * invalidates the submission's closure, records `approved` and queues the closure rebuild, all in one
 * transaction. Activation updates every feature row of the upload and its predecessors, which is why it runs
 * here rather than in the request that recorded the approval.
 *
 * The service locks the upload row and skips uploads that are no longer `approving`, so a duplicate or
 * retried job is a no-op once the approval has been applied. A failure propagates so pg-boss records it and
 * applies its retry policy; the whole application rolls back, so a retry starts clean.
 *
 * @param {PgBoss.Job<IApproveSubmissionUploadJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const approveSubmissionUploadJobHandler: PgBoss.WorkHandler<IApproveSubmissionUploadJobData> = async (jobs) => {
  await Promise.all(
    jobs.map(async (job) => {
      const { submissionUploadId } = job.data;

      defaultLog.info({
        label: 'approveSubmissionUploadJobHandler',
        message: 'Processing approve submission upload job',
        jobId: job.id,
        submissionUploadId
      });

      await withConnection(async (connection) => {
        const submissionUploadService = new SubmissionUploadService(connection);
        await submissionUploadService.applySubmissionUploadApproval(submissionUploadId);
      });

      defaultLog.info({
        label: 'approveSubmissionUploadJobHandler',
        message: 'Approve submission upload job completed successfully',
        jobId: job.id,
        submissionUploadId
      });
    })
  );
};

/**
 * Dead Letter Queue handler for failed approve submission upload jobs.
 *
 * Runs only after the retry policy is exhausted. The failed attempts rolled back, so the upload's features
 * were never activated; the handler returns a still-`approving` upload to `pending` so an administrator can
 * see the approval did not apply and decide again.
 *
 * @param {PgBoss.Job<IApproveSubmissionUploadJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const approveSubmissionUploadFailedHandler: PgBoss.WorkHandler<IApproveSubmissionUploadJobData> = async (
  jobs
) => {
  await Promise.all(
    jobs.map(async (job) => {
      const { submissionUploadId } = job.data;

      // Cast to access output field available on failed jobs
      const jobOutput = (job as PgBoss.JobWithMetadata<IApproveSubmissionUploadJobData>).output;

      defaultLog.warn({
        label: 'approveSubmissionUploadFailedHandler',
        message: 'Approve submission upload job failed after all retries',
        jobId: job.id,
        submissionUploadId,
        output: jobOutput ?? 'Job failed after all retries'
      });

      await withConnection(async (connection) => {
        const submissionUploadService = new SubmissionUploadService(connection);
        await submissionUploadService.revertSubmissionUploadApproval(submissionUploadId);
      });
    })
  );
};
