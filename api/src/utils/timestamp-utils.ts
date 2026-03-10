import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Split an inbound timestamp payload value into normalized date/time parts for
 * `submission_feature_property_timestamp` persistence.
 *
 * Expected persistence mapping:
 * - full datetime (for example `2024-05-10T14:32:00Z`) => `{ date: '2024-05-10', time: '14:32:00' }`
 * - date only (for example `2024-05-10`) => `{ date: '2024-05-10', time: null }`
 * - time only (for example `14:32` or `14:32:00`) => `{ date: null, time: '14:32:00' }`
 * - invalid/unrecognized value => `{ date: null, time: null }`
 *
 * Notes:
 * - Time-only support is intentional for payloads that provide a time without a date.
 * - Time output is normalized to `HH:mm:ss`.
 *
 * @param {string} value Raw timestamp payload value
 * @returns {{ date: string | null; time: string | null }} Normalized date/time components
 */
export function splitTimestampValue(value: string): {
  date: string | null;
  time: string | null;
} {
  const trimmed = value.trim();

  // Full datetime
  const datetime = dayjs(trimmed);
  if (datetime.isValid() && (trimmed.includes('T') || trimmed.includes(' '))) {
    return {
      date: datetime.format('YYYY-MM-DD'),
      time: datetime.format('HH:mm:ss')
    };
  }

  // Date only
  const date = dayjs(trimmed, 'YYYY-MM-DD', true);
  if (date.isValid()) {
    return { date: date.format('YYYY-MM-DD'), time: null };
  }

  // Time only
  const time = dayjs(trimmed, ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'], true);
  if (time.isValid()) {
    return { date: null, time: time.format('HH:mm:ss') };
  }

  return { date: null, time: null };
}
