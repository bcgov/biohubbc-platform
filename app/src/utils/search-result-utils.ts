import { JsonValue } from 'types/json';
import { isStructuredPropertyValue } from './property-value-utils';
import { safeJSONStringify } from './Utils';

/**
 * Formats a submission feature property value for compact table display.
 *
 * Absent values are displayed as an empty string, arrays are flattened into a comma-separated list, reference values
 * (taxon, code, feature) display their `label`, and other object values use the shared safe JSON stringifier so
 * they remain inspectable in grid cells.
 *
 * @param {JsonValue | undefined} value - Raw submission feature property value from the search result row.
 * @returns {string} Display-ready property value.
 */
export const formatSubmissionPropertyValue = (value: JsonValue | undefined): string => {
  // Treat only absent property values as no display value in the compact grid.
  if (value === null || value === undefined) {
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

      // Reference values carry a readable label; it is the cell text, tooltip and quick-filter text.
      if (isStructuredPropertyValue(value)) {
        return value.label;
      }

      // Plain objects, GeoJSON, and nested values should render as JSON, never as "[object Object]".
      const jsonValue = safeJSONStringify(value);

      return typeof jsonValue === 'string' ? jsonValue : '';
    }
  }

  return '';
};
