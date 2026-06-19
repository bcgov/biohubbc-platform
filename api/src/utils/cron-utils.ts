/**
 * Pure helpers for cron-driven scheduling.
 *
 * Small, bounded date math that lives outside the scheduler service so it can be
 * unit-tested in isolation against the real cron parser. The service orchestrates
 * the poll loop; this function is the "when does this fire next" decision.
 */

import { CronExpressionParser } from 'cron-parser';

/**
 * Compute the next run time for a cron expression, as a UTC ISO timestamptz string.
 *
 * The occurrence is strictly **after** `from`: parsing with `currentDate: from`
 * makes `.next()` return the first occurrence strictly after that instant. This
 * matters for the poll loop — after a run completes we pass its own run time (or
 * the moment polling resumes) as `from`, so a just-finished occurrence can never
 * be re-selected and double-fired on the next poll.
 *
 * The cron fields are interpreted in the IANA `timezone`, and the result is
 * returned as a UTC ISO string (a Postgres `timestamptz`). Interpreting in the
 * zone — not server-local time — keeps a schedule like `0 2 * * *` firing at
 * 02:00 local wall-clock on both sides of a DST transition, rather than drifting
 * by an hour relative to the server. Returning UTC keeps the stored/compared
 * value unambiguous regardless of the server's own timezone.
 *
 * @param cronExpression standard cron expression (e.g. `0 2 * * *`).
 * @param timezone IANA timezone name the cron fields are interpreted in (e.g. `America/Vancouver`).
 * @param from the instant the next occurrence must be strictly after.
 * @returns the next occurrence as a UTC ISO 8601 string.
 */
export function computeNextRunDate(cronExpression: string, timezone: string, from: Date): string {
  const interval = CronExpressionParser.parse(cronExpression, { currentDate: from, tz: timezone });
  return interval.next().toDate().toISOString();
}
