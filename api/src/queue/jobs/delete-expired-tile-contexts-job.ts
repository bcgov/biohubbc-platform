import PgBoss from 'pg-boss';
import { TileContextService } from '../../services/tile-context-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/delete-expired-tile-contexts-job');

/**
 * Delete expired tile contexts job data interface.
 *
 * The tick carries no payload — it is a recurring infrastructure trigger, not work scoped to a
 * particular row. The set of expired contexts is discovered from the database each tick.
 */
export type IDeleteExpiredTileContextsJobData = Record<string, never>;

/**
 * Recurring sweep that removes expired map tile contexts and their materialized feature ids.
 *
 * Housekeeping only, never a security control: expiry is enforced in `biohub.tile_search` on every
 * tile request, so an expired context stops authorizing tiles the moment it lapses, whether or not
 * this sweep has run. That is also why a missed tick self-heals — the rows stay expired and inert
 * until the next interval collects them.
 *
 * Failures are logged and re-thrown so pg-boss retries per the queue config and, on exhaustion,
 * moves the tick to the dead letter queue.
 *
 * @param {PgBoss.Job<IDeleteExpiredTileContextsJobData>[]} jobs - The sweep jobs to process.
 * @return {Promise<void>}
 */
export const deleteExpiredTileContextsJobHandler: PgBoss.WorkHandler<IDeleteExpiredTileContextsJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    try {
      const deleted = await withConnection((connection) =>
        new TileContextService(connection).deleteExpiredTileContexts()
      );

      defaultLog.info({
        label: 'deleteExpiredTileContextsJobHandler',
        message: 'Swept expired tile contexts',
        jobId: job.id,
        deleted
      });
    } catch (error) {
      defaultLog.error({
        label: 'deleteExpiredTileContextsJobHandler',
        message: 'Delete expired tile contexts job failed',
        jobId: job.id,
        error
      });

      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed delete-expired-tile-contexts ticks.
 *
 * Log-only by design. Re-throwing here would loop the dead tick forever, and there is nothing to
 * compensate: the next successful sweep collects whatever this one missed.
 *
 * @param {PgBoss.Job<IDeleteExpiredTileContextsJobData>[]} jobs - The failed jobs.
 * @return {Promise<void>}
 */
export const deleteExpiredTileContextsFailedHandler: PgBoss.WorkHandler<IDeleteExpiredTileContextsJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    defaultLog.error({
      label: 'deleteExpiredTileContextsFailedHandler',
      message: 'Delete expired tile contexts tick landed in the dead letter queue',
      jobId: job.id
    });
  }
};
