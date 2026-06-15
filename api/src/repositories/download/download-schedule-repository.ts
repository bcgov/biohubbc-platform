import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  CreateDownloadSchedule,
  DownloadScheduleDueRecord,
  DownloadScheduleRecord,
  UpdateDownloadSchedule
} from '../../models/download-schedule';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download schedule data.
 *
 * A download_schedule is the recurring rebuild configuration that hangs off the
 * stable parent download. On each due occurrence the scheduler mints a new
 * download_version, reusing the same materialization workflow as a manual rerun.
 * At most one active schedule (record_end_date IS NULL) exists per download —
 * soft-deleting the active row is how a recurrence is disabled.
 *
 * @export
 * @class DownloadScheduleRepository
 * @extends {BaseRepository}
 */
export class DownloadScheduleRepository extends BaseRepository {
  /**
   * Create a new download schedule row.
   *
   * Returns the full record (with the generated `download_schedule_id`) so the
   * caller can act on the schedule without a follow-up SELECT. next_run_date is
   * supplied by the service (computed from the cron expression and timezone) —
   * the repository never derives it.
   *
   * @param {CreateDownloadSchedule} payload - The schedule fields to persist.
   * @return {Promise<DownloadScheduleRecord>}
   * @throws {ApiExecuteSQLError} when the insert affects no rows (rowCount !== 1).
   * @memberof DownloadScheduleRepository
   */
  async createDownloadSchedule(payload: CreateDownloadSchedule): Promise<DownloadScheduleRecord> {
    const sql = SQL`
      INSERT INTO download_schedule (download_id, cron_expression, timezone, next_run_date)
      VALUES (${payload.download_id}, ${payload.cron_expression}, ${payload.timezone}, ${payload.next_run_date})
      RETURNING
        download_schedule_id,
        download_id,
        cron_expression,
        timezone,
        next_run_date,
        last_run_date;
    `;

    const response = await this.connection.sql(sql, DownloadScheduleRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download schedule record', [
        'DownloadScheduleRepository->createDownloadSchedule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active download schedule's recurrence (cron expression, timezone, next run).
   *
   * Deliberately does NOT touch last_run_date — an update re-points the recurrence
   * forward without rewriting the run history that records when occurrences actually
   * fired. Scoped to active rows (`record_end_date IS NULL`) so a disabled schedule
   * can't be silently revived by an update; the rowCount guard then surfaces an
   * attempt to edit a missing or disabled schedule rather than no-op'ing.
   *
   * @param {number} downloadScheduleId - The download schedule ID.
   * @param {UpdateDownloadSchedule} payload - The recurrence fields to update.
   * @return {Promise<DownloadScheduleRecord>}
   * @throws {ApiExecuteSQLError} when no active schedule matches the given ID (rowCount !== 1).
   * @memberof DownloadScheduleRepository
   */
  async updateDownloadSchedule(
    downloadScheduleId: number,
    payload: UpdateDownloadSchedule
  ): Promise<DownloadScheduleRecord> {
    const sql = SQL`
      UPDATE download_schedule
      SET
        cron_expression = ${payload.cron_expression},
        timezone = ${payload.timezone},
        next_run_date = ${payload.next_run_date}
      WHERE download_schedule_id = ${downloadScheduleId}
        AND record_end_date IS NULL
      RETURNING
        download_schedule_id,
        download_id,
        cron_expression,
        timezone,
        next_run_date,
        last_run_date;
    `;

    const response = await this.connection.sql(sql, DownloadScheduleRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download schedule record', [
        'DownloadScheduleRepository->updateDownloadSchedule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find the active schedule for a download, if one exists.
   *
   * At most one active schedule (`record_end_date IS NULL`) hangs off a download,
   * so this resolves the single live recurrence. `find*` returns null on missing
   * (codebase convention) — a download with no recurrence is an expected state,
   * not an error.
   *
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<DownloadScheduleRecord | null>}
   * @memberof DownloadScheduleRepository
   */
  async findActiveScheduleByDownloadId(downloadId: string): Promise<DownloadScheduleRecord | null> {
    const sql = SQL`
      SELECT
        download_schedule_id,
        download_id,
        cron_expression,
        timezone,
        next_run_date,
        last_run_date
      FROM download_schedule
      WHERE download_id = ${downloadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadScheduleRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Disable a schedule by soft-deleting its active row.
   *
   * Stamping `record_end_date` is how a recurrence is turned off — the row stays
   * for audit but is excluded from every active-scoped query (the due scan, the
   * per-download active lookup). Scoped to active rows so disabling an already-
   * disabled schedule is caught by the rowCount guard rather than silently no-op'ing.
   *
   * @param {number} downloadScheduleId - The download schedule ID.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} when no active schedule matches the given ID (rowCount !== 1).
   * @memberof DownloadScheduleRepository
   */
  async disableSchedule(downloadScheduleId: number): Promise<void> {
    const sql = SQL`
      UPDATE download_schedule
      SET record_end_date = now()
      WHERE download_schedule_id = ${downloadScheduleId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to disable download schedule record', [
        'DownloadScheduleRepository->disableSchedule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Claim the schedules whose next occurrence is due, for processing this tick.
   *
   * `FOR UPDATE SKIP LOCKED` lets concurrent pollers each grab a disjoint set of
   * due rows without blocking each other — a row a peer already holds is skipped,
   * not waited on, so two ticks never fight over the same schedule. The active+due
   * filter (`record_end_date IS NULL AND next_run_date <= now()`) keeps disabled
   * schedules inert even when their next_run_date is already in the past. `LIMIT`
   * bounds the claim per tick so a built-up backlog can't fan out into an
   * unbounded burst of reruns. An empty result is a valid outcome (nothing due),
   * so there is no rowCount guard.
   *
   * @param {number} limit - The maximum number of due schedules to claim this tick.
   * @return {Promise<DownloadScheduleDueRecord[]>}
   * @memberof DownloadScheduleRepository
   */
  async claimDueSchedules(limit: number): Promise<DownloadScheduleDueRecord[]> {
    const sql = SQL`
      SELECT
        download_schedule_id,
        download_id,
        cron_expression,
        timezone
      FROM download_schedule
      WHERE next_run_date <= now()
        AND record_end_date IS NULL
      ORDER BY next_run_date
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit};
    `;

    const response = await this.connection.sql(sql, DownloadScheduleDueRecord);

    return response.rows;
  }

  /**
   * Mark a schedule as having run, advancing it to its next occurrence.
   *
   * Records the run on last_run_date and re-points next_run_date forward. Advancing
   * next_run_date in the same transaction that enqueues the rerun makes the row no
   * longer due, so a completed occurrence can't be re-selected on the next poll —
   * this is the at-most-once guarantee for a given occurrence.
   *
   * @param {number} downloadScheduleId - The download schedule ID.
   * @param {string} nextRunDate - The next computed run timestamp.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} when no schedule matches the given ID (rowCount !== 1).
   * @memberof DownloadScheduleRepository
   */
  async markRun(downloadScheduleId: number, nextRunDate: string): Promise<void> {
    const sql = SQL`
      UPDATE download_schedule
      SET
        last_run_date = now(),
        next_run_date = ${nextRunDate}
      WHERE download_schedule_id = ${downloadScheduleId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to mark download schedule run', [
        'DownloadScheduleRepository->markRun',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
