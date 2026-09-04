import PgBoss from 'pg-boss';
import { RECONCILE_START_STATUSES } from '../../constants/submission-upload';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SecurityService } from '../../services/security-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';
import { publishIndexSubmissionFeaturesJob } from '../publisher';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/reconcile-submission-features-job');

export const reconcileSubmissionFeaturesJobDependencies = {
  publishIndexSubmissionFeaturesJob
};

export interface IReconcileSubmissionFeaturesJobData {
  submissionUploadId: string;
}

/**
 * Reconcile upload-owned submission features before indexing.
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
      const submissionUploadService = new SubmissionUploadService(connection);
      const upload = await submissionUploadService.getSubmissionUploadWithLock(submissionUploadId);
      if (!RECONCILE_START_STATUSES.includes(upload.status)) {
        return;
      }

      await submissionUploadService.transitionSubmissionUploadToReconciling(submissionUploadId);
      const submissionUploadReconciliationService = new SubmissionUploadReconciliationService(connection);
      const invalidSourceIdentityFeatureCount =
        await submissionUploadReconciliationService.validateSubmissionFeatureSourceIdentity(submissionUploadId);
      if (invalidSourceIdentityFeatureCount > 0) {
        await submissionUploadService.transitionSubmissionUploadToInvalid(submissionUploadId);
        return;
      }

      const predecessorSubmissionUploadId = await submissionUploadReconciliationService.reconcileSubmissionFeatures(
        submissionUploadId
      );
      const securityService = new SecurityService(connection);
      await securityService.copyPredecessorSecurityRulesToSuccessors(submissionUploadId, predecessorSubmissionUploadId);
      if (predecessorSubmissionUploadId) {
        await submissionUploadReconciliationService.endPendingSubmissionFeatures(predecessorSubmissionUploadId);
      }
      await submissionUploadService.transitionSubmissionUploadToReconciled(submissionUploadId);
      await reconcileSubmissionFeaturesJobDependencies.publishIndexSubmissionFeaturesJob(connection, {
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
      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.transitionSubmissionUploadToFailed(job.data.submissionUploadId);
    });
    defaultLog.warn({
      label: 'reconcileSubmissionFeaturesFailedHandler',
      message: 'Reconciliation job failed after all retries',
      jobId: job.id,
      ...job.data
    });
  }
};
