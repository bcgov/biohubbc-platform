import PgBoss from 'pg-boss';
import { SubmissionMetricsService } from '../../services/submission-metrics-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/compute-submission-metrics-job');

/** Nightly platform metrics tick; source data is discovered at execution time. */
export type IComputeSubmissionMetricsJobData = Record<string, never>;

/** Commit a complete snapshot, or roll back and let pg-boss retry on failure. */
export const computeSubmissionMetricsJobHandler: PgBoss.WorkHandler<IComputeSubmissionMetricsJobData> = async (
  jobs: Parameters<PgBoss.WorkHandler<IComputeSubmissionMetricsJobData>>[0]
) => {
  await Promise.all(
    jobs.map(async (job) => {
      try {
        await withConnection((connection) => new SubmissionMetricsService(connection).calculateMetrics());
        defaultLog.info({
          label: 'computeSubmissionMetricsJobHandler',
          jobId: job.id,
          message: 'Metrics snapshot saved'
        });
      } catch (error) {
        defaultLog.error({
          label: 'computeSubmissionMetricsJobHandler',
          message: 'Metrics calculation failed',
          jobId: job.id,
          error
        });
        throw error;
      }
    })
  );
};

/** Log exhausted retries; previous successful snapshots remain available. */
export const computeSubmissionMetricsFailedHandler: PgBoss.WorkHandler<IComputeSubmissionMetricsJobData> = (jobs) => {
  for (const job of jobs) {
    defaultLog.error({
      label: 'computeSubmissionMetricsFailedHandler',
      jobId: job.id,
      message: 'Metrics retries exhausted'
    });
  }
  return Promise.resolve();
};
