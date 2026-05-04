import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/**
 * Kind of timestamp scalar after it has been split into date/time parts.
 */
export type ParsedTimestampKind = 'date' | 'time' | 'datetime';

/**
 * Timestamp scalar split into the date/time parts used by persistence.
 */
export type ParsedTimestamp = {
  kind: ParsedTimestampKind;
  date_value: string | null;
  time_value: string | null;
};

/**
 * Parses a public timestamp scalar into the split date/time representation used by expression predicates.
 *
 * Supported inputs are intentionally narrow:
 * - `YYYY-MM-DD` for date-only comparisons.
 * - `HH:mm`, `HH:mm:ss`, and those same time forms with `Z` or `+/-HH:mm` offsets for time-only comparisons.
 * - `YYYY-MM-DDT<time>` for combined datetime comparisons.
 *
 * The returned strings preserve the caller-provided scalar parts rather than normalizing to local time. Returns `null`
 * when the value is not one of the supported scalar forms or when dayjs strict parsing rejects the calendar/time value.
 *
 * @param {string} value - Timestamp-like scalar supplied by an expression predicate.
 * @return {ParsedTimestamp | null} Split timestamp parts, or null when unsupported/invalid.
 */
export const parseTimestamp = (value: string): ParsedTimestamp | null => {
  if (isValidDateOnly(value)) {
    // Date-only input maps to the date persistence column and leaves time empty.
    return { kind: 'date', date_value: value, time_value: null };
  }

  if (isValidTimeOnly(value)) {
    // Time-only input maps to the time persistence column and leaves date empty.
    return { kind: 'time', date_value: null, time_value: value };
  }

  const [datePart, timePart, extraPart] = value.split('T');
  if (datePart && timePart && extraPart === undefined && isValidDateOnly(datePart) && isValidTimeOnly(timePart)) {
    // Datetime input is split at `T` so persistence can keep date and time parts separately.
    return { kind: 'datetime', date_value: datePart, time_value: timePart };
  }

  // Unsupported or ambiguous timestamp strings are rejected by returning null.
  return null;
};

/**
 * Checks whether a value is a strict date-only scalar.
 *
 * Used before assigning `date_value` so invalid calendar dates such as `2024-02-31` are rejected instead of being
 * coerced by JavaScript date parsing.
 *
 * @param {string} value - Candidate date-only value.
 * @return {boolean} True when the value is exactly `YYYY-MM-DD` and represents a valid calendar date.
 */
const isValidDateOnly = (value: string): boolean => {
  return dayjs(value, 'YYYY-MM-DD', true).isValid();
};

/**
 * Checks whether a value is a supported strict time-only scalar.
 *
 * The optional timezone offset is removed before strict local-time validation because the expression storage keeps the
 * original time string. Validation is performed by anchoring the time to an arbitrary date and parsing with dayjs.
 *
 * @param {string} value - Candidate time-only value, optionally with `Z` or `+/-HH:mm` offset.
 * @return {boolean} True when the time portion and optional offset are supported and valid.
 */
const isValidTimeOnly = (value: string): boolean => {
  const timeParts = splitTimeAndOffset(value);

  if (!timeParts) {
    return false;
  }

  return dayjs(`2000-01-01T${timeParts.time}`, ['YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ss'], true).isValid();
};

/**
 * Splits a supported timezone suffix from a time scalar.
 *
 * This helper does not validate the clock time itself; it only separates and validates the optional offset so
 * `isValidTimeOnly` can strict-parse the `HH:mm` or `HH:mm:ss` portion separately.
 *
 * @param {string} value - Candidate time scalar.
 * @return {{ time: string; offset: string | null } | null} Time without offset plus offset, or null for invalid offset.
 */
const splitTimeAndOffset = (value: string): { time: string; offset: string | null } | null => {
  const offsetMatch = /(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const offset = offsetMatch?.[0] ?? null;
  const time = offset ? value.slice(0, -offset.length) : value;

  if (offset && !dayjs(`2000-01-01T00:00:00${offset}`).isValid()) {
    return null;
  }

  return { time, offset };
};
