import { safeJSONStringify } from './Utils';

/**
 * Formats a submission feature property value for compact table display.
 *
 * Primitive values are stringified directly, arrays are flattened into a comma-separated list, and object values use
 * the shared safe JSON stringifier so structured values remain inspectable in grid cells. Nullish values are displayed
 * as an empty string.
 *
 * @param {unknown} value - Raw submission feature property value from the search result row.
 * @returns {string} Display-ready property value.
 */
export const formatSubmissionPropertyValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map(formatSubmissionPropertyValue).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    return String(safeJSONStringify(value));
  }

  return String(value);
};
