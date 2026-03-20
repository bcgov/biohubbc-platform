import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/cleanup-invalid-submission-uploads-job');

export interface ICleanupInvalidSubmissionUploadsJobData {
  retentionHours?: number;
  limit?: number;
}

const DEFAULT_RETENTION_HOURS = 24 * 7;
const DEFAULT_BATCH_LIMIT = 100;

/**
 * Cleanup invalid submission upload attempts older than retention.
 *
 * @param {PgBoss.Job<ICleanupInvalidSubmissionUploadsJobData>[]} jobs
 * @returns {Promise<void>}
 */
export const cleanupInvalidSubmissionUploadsJobHandler: PgBoss.WorkHandler<
  ICleanupInvalidSubmissionUploadsJobData
> = async (jobs) => {
  for (const job of jobs) {
    const retentionHours = job.data?.retentionHours ?? DEFAULT_RETENTION_HOURS;
    const limit = job.data?.limit ?? DEFAULT_BATCH_LIMIT;
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const submissionUploadService = new SubmissionUploadService(connection);
      const invalidSubmissionUploadIds = await submissionUploadService.getInvalidSubmissionUploadIdsForCleanup(
        retentionHours,
        limit
      );

      for (const submissionUploadId of invalidSubmissionUploadIds) {
        await submissionUploadService.cleanupInvalidSubmissionUploadById(submissionUploadId);
      }

      await connection.commit();

      defaultLog.info({
        label: 'cleanupInvalidSubmissionUploadsJobHandler',
        message: 'Cleanup completed',
        jobId: job.id,
        retentionHours,
        processed: invalidSubmissionUploadIds.length
      });
    } catch (error) {
      await connection.rollback();
      defaultLog.error({
        label: 'cleanupInvalidSubmissionUploadsJobHandler',
        message: 'Cleanup failed',
        jobId: job.id,
        error
      });
      throw error;
    } finally {
      connection.release();
    }
  }
};
