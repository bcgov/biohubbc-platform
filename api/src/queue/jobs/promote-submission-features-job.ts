import PgBoss from 'pg-boss';
import { PROMOTE_START_STATUSES } from '../../constants/submission-upload';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { publishIndexSubmissionFeaturesJob } from '../publisher';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/promote-submission-features-job');

export const promoteSubmissionFeaturesJobDependencies = {
  publishIndexSubmissionFeaturesJob
};

export interface IPromoteSubmissionFeaturesJobData {
  submissionUploadId: string;
}

/**
 * Promote prepared changed features for an upload.
 *
 * @param {PgBoss.Job<IPromoteSubmissionFeaturesJobData>[]} jobs Batched pg-boss jobs.
 * @returns {Promise<void>}
 */
export const promoteSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IPromoteSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionUploadId } = job.data;
    await withConnection(async (connection) => {
      const uploadService = new SubmissionUploadService(connection);
      const reconciliationService = new SubmissionUploadReconciliationService(connection);
      const upload = await uploadService.getSubmissionUploadWithLock(submissionUploadId);
      if (!PROMOTE_START_STATUSES.includes(upload.status)) {
        return;
      }

      await uploadService.transitionSubmissionUploadToPromoting(submissionUploadId);
      await reconciliationService.promoteSubmissionUploadFeatures(submissionUploadId);
      await uploadService.transitionSubmissionUploadToPromoted(submissionUploadId);
      await promoteSubmissionFeaturesJobDependencies.publishIndexSubmissionFeaturesJob(connection, {
        submissionUploadId
      });
    });
  }
};

/**
 * Mark promotion jobs that exhausted retries as operational failures.
 *
 * @param {PgBoss.Job<IPromoteSubmissionFeaturesJobData>[]} jobs Failed pg-boss jobs.
 * @returns {Promise<void>}
 */
export const promoteSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IPromoteSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    await withConnection(async (connection) => {
      const uploadService = new SubmissionUploadService(connection);
      await uploadService.transitionSubmissionUploadStatus(job.data.submissionUploadId, 'failed', [
        'reconciled',
        'promoting',
        'failed'
      ]);
    });
    defaultLog.warn({
      label: 'promoteSubmissionFeaturesFailedHandler',
      message: 'Promotion job failed after all retries',
      jobId: job.id,
      ...job.data
    });
  }
};
