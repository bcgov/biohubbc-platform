import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export type RelativeTimeInput = string | Date | Dayjs | null | undefined;

export interface IRelativeTimeLabelOptions {
  maxRelativeDays?: number;
  absoluteFormat?: string;
  now?: Dayjs;
}

/**
 * Format a date value as a relative label (for example `2 hours ago`).
 * Optionally falls back to absolute formatting when the date is older/newer
 * than `maxRelativeDays` from `now`.
 */
export const getRelativeTimeLabel = (
  value: RelativeTimeInput,
  options: IRelativeTimeLabelOptions = {}
): string | null => {
  const maxRelativeDays = options.maxRelativeDays;
  const absoluteFormat = options.absoluteFormat ?? 'MMM D, YYYY';
  const now = options.now ?? dayjs();
  const date = value ? dayjs(value) : null;

  if (!date || !date.isValid()) {
    return null;
  }

  if (typeof maxRelativeDays === 'number' && Math.abs(now.diff(date, 'day')) > maxRelativeDays) {
    return date.format(absoluteFormat);
  }

  return date.from(now);
};
