import PgBoss from 'pg-boss';
import { DownloadScheduleService } from '../../services/download/download-schedule-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/poll-download-schedules-job');

/**
 * Poll download schedules job data interface.
 *
 * The tick carries no payload — it is a recurring infrastructure trigger, not work scoped to a
 * particular row. The handler reads no `job.data`; the set of due schedules is discovered from the
 * database each tick.
 */
export type IPollDownloadSchedulesJobData = Record<string, never>;

/**
 * Recurring poll that drives every due download-schedule rerun for this tick.
 *
 * The poll only enqueues — it claims due schedules, advances each past now(), and lets
 * `runDueSchedules` publish a process-download job per occurrence. The heavy Parquet rebuild stays a
 * separate background job, so a slow rebuild never blocks the tick: the poll does bounded DB work
 * (claim + advance + enqueue) and returns. Each tick runs in its own short-lived transaction via
 * `withConnection` — claim, advance, and enqueue commit together, so an occurrence is neither
 * skipped nor double-fired.
 *
 * Failures are logged and re-thrown so pg-boss retries per the queue config and, on exhaustion,
 * moves the tick to the dead letter queue. A missed tick self-heals: still-due schedules remain due
 * and are picked up on the next interval.
 *
 * @param {PgBoss.Job<IPollDownloadSchedulesJobData>[]} jobs - The poll jobs to process.
 * @return {Promise<void>}
 */
export const pollDownloadSchedulesJobHandler: PgBoss.WorkHandler<IPollDownloadSchedulesJobData> = async (jobs) => {
  for (const job of jobs) {
    defaultLog.info({
      label: 'pollDownloadSchedulesJobHandler',
      message: 'Polling due download schedules',
      jobId: job.id
    });

    try {
      await withConnection((connection) => new DownloadScheduleService(connection).runDueSchedules());
    } catch (error) {
      defaultLog.error({
        label: 'pollDownloadSchedulesJobHandler',
        message: 'Poll download schedules job failed',
        jobId: job.id,
        error
      });

      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed poll-download-schedules ticks.
 *
 * Log-only by design. Re-throwing here would loop the dead tick forever, and there is no terminal
 * status row to write — the poll owns no per-occurrence state (the schedules it claimed already
 * advanced and enqueued, or did not, inside the failed tick's transaction). A missed tick is
 * self-healing: still-due schedules stay due and are claimed on the next interval, so the only
 * action a dead tick warrants is an operator-visible log line.
 *
 * @param {PgBoss.Job<IPollDownloadSchedulesJobData>[]} jobs - The failed ticks (post-retry).
 * @return {Promise<void>}
 */
export const pollDownloadSchedulesFailedHandler: PgBoss.WorkHandler<IPollDownloadSchedulesJobData> = async (jobs) => {
  for (const job of jobs) {
    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IPollDownloadSchedulesJobData>).output;

    defaultLog.warn({
      label: 'pollDownloadSchedulesFailedHandler',
      message: 'Poll download schedules tick failed after all retries',
      jobId: job.id,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};
