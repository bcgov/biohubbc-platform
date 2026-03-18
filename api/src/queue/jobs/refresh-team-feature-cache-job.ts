import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { TeamFeatureService } from '../../services/access-policy/team-feature-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/refresh-team-feature-cache-job');

/**
 * Refresh team_feature cache job data interface.
 * Contains the team UUID whose cache needs rebuilding.
 */
export interface IRefreshTeamFeatureCacheJobData {
  /** The team UUID whose cache needs refreshing */
  teamId: string;
}

/**
 * Refresh team_feature cache job handler.
 *
 * Rebuilds the team_feature cache for a single team via delete+insert.
 * Runs outside the HTTP request path so policy mutations aren't blocked
 * by potentially large cache rebuilds (millions of rows at scale).
 *
 * Global singleton key (`team-feature-refresh`) ensures only one refresh
 * runs at a time across all workers — prevents concurrent bulk delete+insert
 * operations from swamping the DB regardless of worker replica count.
 *
 * @param {PgBoss.Job<IRefreshTeamFeatureCacheJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const refreshTeamFeatureCacheJobHandler: PgBoss.WorkHandler<IRefreshTeamFeatureCacheJobData> = async (jobs) => {
  for (const job of jobs) {
    const { teamId } = job.data;

    defaultLog.info({
      label: 'refreshTeamFeatureCacheJobHandler',
      message: 'Processing refresh team feature cache job',
      jobId: job.id,
      teamId
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const teamFeatureService = new TeamFeatureService(connection);
      await teamFeatureService.refreshCacheForTeam(teamId);

      await connection.commit();

      defaultLog.info({
        label: 'refreshTeamFeatureCacheJobHandler',
        message: 'Refresh team feature cache job completed successfully',
        jobId: job.id,
        teamId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'refreshTeamFeatureCacheJobHandler',
        message: 'Refresh team feature cache job failed',
        jobId: job.id,
        teamId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    } finally {
      connection.release();
    }
  }
};

/**
 * Dead Letter Queue handler for failed refresh team feature cache jobs.
 *
 * Cache staleness is not critical — the source of truth (team_policy +
 * policy_statement) is intact, and a subsequent policy mutation will trigger
 * another refresh. This handler only logs the failure.
 *
 * @param {PgBoss.Job<IRefreshTeamFeatureCacheJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const refreshTeamFeatureCacheFailedHandler: PgBoss.WorkHandler<IRefreshTeamFeatureCacheJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { teamId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IRefreshTeamFeatureCacheJobData>).output;

    defaultLog.warn({
      label: 'refreshTeamFeatureCacheFailedHandler',
      message: 'Refresh team feature cache job failed after all retries',
      jobId: job.id,
      teamId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
