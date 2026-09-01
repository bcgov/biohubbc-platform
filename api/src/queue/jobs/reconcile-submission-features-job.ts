import PgBoss from 'pg-boss';
import { RECONCILE_START_STATUSES } from '../../constants/submission-upload';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { publishPromoteSubmissionFeaturesJob } from '../publisher';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/reconcile-submission-features-job');

export const reconcileSubmissionFeaturesJobDependencies = {
  publishPromoteSubmissionFeaturesJob
};

export interface IReconcileSubmissionFeaturesJobData {
  submissionUploadId: string;
}

/**
 * Reconcile durable staging for an upload.
 *
 * @param {PgBoss.Job<IReconcileSubmissionFeaturesJobData>[]} jobs Batched pg-boss jobs.
 * @returns {Promise<void>}
 */
export const reconcileSubmissionFeaturesJobHandler: PgBoss.WorkHandler<IReconcileSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { submissionUploadId } = job.data;
    await withConnection(async (connection) => {
      const uploadService = new SubmissionUploadService(connection);
      const upload = await uploadService.getSubmissionUploadWithLock(submissionUploadId);
      if (!RECONCILE_START_STATUSES.includes(upload.status)) {
        return;
      }

      await uploadService.transitionSubmissionUploadToReconciling(submissionUploadId);
      const service = new SubmissionUploadReconciliationService(connection);
      const counts = await service.reconcileSubmissionUploadFeatures(submissionUploadId);
      if (counts.conflict > 0) {
        await uploadService.transitionSubmissionUploadToInvalid(submissionUploadId);
        return;
      }

      await uploadService.transitionSubmissionUploadToReconciled(submissionUploadId);
      await reconcileSubmissionFeaturesJobDependencies.publishPromoteSubmissionFeaturesJob(connection, {
        submissionUploadId
      });
    });
  }
};

/**
 * Mark reconciliation jobs that exhausted retries as operational failures.
 *
 * @param {PgBoss.Job<IReconcileSubmissionFeaturesJobData>[]} jobs Failed pg-boss jobs.
 * @returns {Promise<void>}
 */
export const reconcileSubmissionFeaturesFailedHandler: PgBoss.WorkHandler<IReconcileSubmissionFeaturesJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    await withConnection(async (connection) => {
      const uploadService = new SubmissionUploadService(connection);
      await uploadService.transitionSubmissionUploadStatus(job.data.submissionUploadId, 'failed', [
        'ingested',
        'reconciling',
        'failed'
      ]);
    });
    defaultLog.warn({
      label: 'reconcileSubmissionFeaturesFailedHandler',
      message: 'Reconciliation job failed after all retries',
      jobId: job.id,
      ...job.data
    });
  }
};
