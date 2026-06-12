import { JsonValue } from 'types/json';
import { safeJSONStringify } from './Utils';

/**
 * Formats a submission feature property value for compact table display.
 *
 * Falsy values are displayed as an empty string, arrays are flattened into a comma-separated list, and object values
 * use the shared safe JSON stringifier so structured values remain inspectable in grid cells.
 *
 * @param {JsonValue | undefined} value - Raw submission feature property value from the search result row.
 * @returns {string} Display-ready property value.
 */
export const formatSubmissionPropertyValue = (value: JsonValue | undefined): string => {
  // Treat absent, empty, and falsey property values as no display value in the compact grid.
  if (!value) {
    return '';
  }

  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
      return value.toString();
    case 'object': {
      // Arrays represent multi-value properties; flatten displayable entries and skip blanks.
      if (Array.isArray(value)) {
        return value.map(formatSubmissionPropertyValue).filter(Boolean).join(', ');
      }

      // Plain objects, GeoJSON, and nested values should render as JSON, never as "[object Object]".
      const jsonValue = safeJSONStringify(value);

      return typeof jsonValue === 'string' ? jsonValue : '';
    }
  }
};
