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
 * Parses a timestamp-like scalar string into separate date/time parts.
 *
 * Supports date-only, time-only, and datetime strings. Returns null when the input cannot be split safely.
 */
export const parseTimestamp = (value: string): ParsedTimestamp | null => {
  const datePattern = /^(\d{4}-\d{2}-\d{2})$/;
  const timePattern = /^(\d{2}:\d{2}(?::\d{2}(?:Z|[+-]\d{2}:\d{2})?)?)$/;
  const dateTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?)$/;

  const dateMatch = datePattern.exec(value);
  if (dateMatch) {
    // Date-only input maps to the date persistence column and leaves time empty.
    return { kind: 'date', date_value: dateMatch[1], time_value: null };
  }

  const timeMatch = timePattern.exec(value);
  if (timeMatch) {
    // Time-only input maps to the time persistence column and leaves date empty.
    return { kind: 'time', date_value: null, time_value: timeMatch[1] };
  }

  const dateTimeMatch = dateTimePattern.exec(value);
  if (dateTimeMatch) {
    // Datetime input is split at `T` so persistence can keep date and time parts separately.
    return { kind: 'datetime', date_value: dateTimeMatch[1], time_value: dateTimeMatch[2] };
  }

  // Unsupported or ambiguous timestamp strings are rejected by returning null.
  return null;
};
