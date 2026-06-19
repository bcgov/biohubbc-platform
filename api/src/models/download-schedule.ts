import { z } from 'zod';

/**
 * A download_schedule is a recurring rebuild configuration that hangs off the stable parent download.
 * On each due occurrence the scheduler mints a new download_version, reusing the same materialization
 * workflow as a manual rerun.
 *
 * The public record omits record_end_date — soft-delete state is internal and never returned to callers.
 */
export const DownloadScheduleRecord = z.object({
  download_schedule_id: z.number(),
  download_id: z.string().uuid(),
  cron_expression: z.string(),
  timezone: z.string(),
  next_run_date: z.string().nullable(),
  last_run_date: z.string().nullable()
});
export type DownloadScheduleRecord = z.infer<typeof DownloadScheduleRecord>;

/**
 * The thin shape claimed by the poll — only what running a due occurrence needs to recompute the next
 * run and fire a rerun. Kept minimal so the due-scan SELECT stays narrow.
 */
export const DownloadScheduleDueRecord = z.object({
  download_schedule_id: z.number(),
  download_id: z.string().uuid(),
  cron_expression: z.string(),
  timezone: z.string()
});
export type DownloadScheduleDueRecord = z.infer<typeof DownloadScheduleDueRecord>;

/**
 * Persisted payload for creating a schedule. next_run_date is computed by the service from the cron
 * expression and timezone before the write — the repository never derives it.
 */
export const CreateDownloadSchedule = z.object({
  download_id: z.string().uuid(),
  cron_expression: z.string(),
  timezone: z.string(),
  next_run_date: z.string()
});
export type CreateDownloadSchedule = z.infer<typeof CreateDownloadSchedule>;

/**
 * Persisted payload for updating an active schedule. Deliberately excludes last_run_date — an update
 * re-points the recurrence (cron/tz/next_run_date) without touching run history.
 */
export const UpdateDownloadSchedule = z.object({
  cron_expression: z.string(),
  timezone: z.string(),
  next_run_date: z.string()
});
export type UpdateDownloadSchedule = z.infer<typeof UpdateDownloadSchedule>;
