import { IDBConnection } from '../../database/db';
import { HTTP400, HTTP404 } from '../../errors/http-error';
import { DownloadScheduleRecord } from '../../models/download-schedule';
import { DownloadScheduleRepository } from '../../repositories/download/download-schedule-repository';
import { computeNextRunDate } from '../../utils/cron-utils';
import { DBService } from '../db-service';
import { DownloadService } from './download-service';

/**
 * Bounded number of due schedules claimed per scheduler tick, so a built-up backlog can't fan out
 * into an unbounded burst of reruns.
 */
const POLL_BATCH_LIMIT = 100; // bounded claim per tick

/**
 * The single zone every schedule's cron fields are interpreted in. Caller-configurable per-schedule
 * timezone is speculative flexibility the product doesn't need yet, so it's fixed server-side. The
 * `timezone` column persists this value, so promoting it back to a caller-supplied field is a pure
 * additive change (no migration) if a second zone ever becomes real.
 */
const SCHEDULE_TIMEZONE = 'America/Vancouver';

/**
 * The recurrence fields a caller supplies when creating or updating a schedule. `next_run_date` and
 * `timezone` are not part of the request — the service computes the next run from the cron expression
 * and the fixed {@link SCHEDULE_TIMEZONE}.
 */
export interface CreateDownloadScheduleRequest {
  cron_expression: string;
}

/**
 * Service for the recurring rebuild schedule that hangs off a stable parent download.
 *
 * A download_schedule mints a new download_version on each due occurrence, reusing the same
 * materialization path as a manual rerun (DownloadService.rerunDownload) rather than
 * re-implementing it. Composes DownloadService so the rerun primitive (which owns the worker
 * publisher) is never duplicated here. These are admin-managed endpoints — authorization
 * (System Administrator role) is enforced at the route, so the service only checks that the parent
 * download exists, not team membership.
 *
 * @export
 * @class DownloadScheduleService
 * @extends {DBService}
 */
export class DownloadScheduleService extends DBService {
  downloadService: DownloadService;
  downloadScheduleRepository: DownloadScheduleRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadService = new DownloadService(connection);
    this.downloadScheduleRepository = new DownloadScheduleRepository(connection);
  }

  /**
   * Create or update the active recurring schedule for a download.
   *
   * Confirms the parent download exists first (HTTP404 otherwise), so no schedule state is read or
   * written — and no FK violation surfaces — for a download that isn't there. An invalid cron
   * expression maps to an HTTP400 at this system boundary BEFORE any repository write — user input is
   * validated once, up front. Authorization (System Administrator role) is enforced at the route, not
   * here.
   *
   * At most one active schedule exists per download (a partial unique index makes a second active
   * row impossible), so this upserts: it updates the existing active row if one is found, otherwise
   * creates one. The repository receives the snake_case persisted payloads.
   *
   * @param {string} downloadId - The parent download ID.
   * @param {CreateDownloadScheduleRequest} request - The recurrence (cron expression).
   * @return {Promise<DownloadScheduleRecord>} The created or updated schedule.
   * @memberof DownloadScheduleService
   */
  async upsertSchedule(downloadId: string, request: CreateDownloadScheduleRequest): Promise<DownloadScheduleRecord> {
    const download = await this.downloadService.findDownloadById(downloadId);
    if (!download) {
      throw new HTTP404('Download not found');
    }

    let nextRunDate: string;
    try {
      nextRunDate = computeNextRunDate(request.cron_expression, SCHEDULE_TIMEZONE, new Date());
    } catch {
      throw new HTTP400('Invalid cron expression');
    }

    const existing = await this.downloadScheduleRepository.findActiveScheduleByDownloadId(downloadId);

    if (existing) {
      return this.downloadScheduleRepository.updateDownloadSchedule(existing.download_schedule_id, {
        cron_expression: request.cron_expression,
        timezone: SCHEDULE_TIMEZONE,
        next_run_date: nextRunDate
      });
    }

    return this.downloadScheduleRepository.createDownloadSchedule({
      download_id: downloadId,
      cron_expression: request.cron_expression,
      timezone: SCHEDULE_TIMEZONE,
      next_run_date: nextRunDate
    });
  }

  /**
   * Get the active recurring schedule for a download.
   *
   * A download with no active recurrence (including a download that does not exist) is not an error
   * state at the repository, but the API surfaces it as HTTP404 — the caller asked for a schedule
   * that does not exist. Authorization (System Administrator role) is enforced at the route.
   *
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<DownloadScheduleRecord>} The active schedule.
   * @memberof DownloadScheduleService
   */
  async getActiveSchedule(downloadId: string): Promise<DownloadScheduleRecord> {
    const schedule = await this.downloadScheduleRepository.findActiveScheduleByDownloadId(downloadId);

    if (!schedule) {
      throw new HTTP404('Download schedule not found');
    }

    return schedule;
  }

  /**
   * Disable the active recurring schedule for a download.
   *
   * Soft-deleting the active row is how a recurrence is turned off. HTTP404 when there is no active
   * schedule to disable (including when the download does not exist). Authorization (System
   * Administrator role) is enforced at the route.
   *
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<void>}
   * @memberof DownloadScheduleService
   */
  async disableSchedule(downloadId: string): Promise<void> {
    const schedule = await this.downloadScheduleRepository.findActiveScheduleByDownloadId(downloadId);

    if (!schedule) {
      throw new HTTP404('Download schedule not found');
    }

    await this.downloadScheduleRepository.disableSchedule(schedule.download_schedule_id);
  }

  /**
   * Run every schedule whose next occurrence is due, for this scheduler tick.
   *
   * System context — this is the scheduler itself, not a user action, so there is no per-user
   * authorization (no getAuthorizedDownload). Claims a bounded batch of due schedules, then for each
   * one advances the schedule past now() (markRun with the next computed run date) BEFORE firing the
   * rerun. Advancing first means a completed occurrence is no longer due and can't be re-selected and
   * double-fired on the next poll.
   *
   * @return {Promise<void>}
   * @memberof DownloadScheduleService
   */
  async runDueSchedules(): Promise<void> {
    const due = await this.downloadScheduleRepository.claimDueSchedules(POLL_BATCH_LIMIT);

    for (const schedule of due) {
      const nextRunDate = computeNextRunDate(schedule.cron_expression, schedule.timezone, new Date());
      await this.downloadScheduleRepository.markRun(schedule.download_schedule_id, nextRunDate); // advance BEFORE rerun
      await this.downloadService.rerunDownload(schedule.download_id);
    }
  }
}
