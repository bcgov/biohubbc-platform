/**
 * Normalizes a query parameter value to a lowercase string.
 *
 * - Coerces numbers and booleans to strings
 * - Converts `null` and `undefined` to an empty string
 * - Lowercases the resulting value
 *
 * Useful for safely handling URL query params before comparison or filtering.
 *
 * @param value - The query parameter value to normalize
 * @returns The normalized lowercase string (empty string for nullish values)
 */
export const normalizeQueryParam = (value: string | number | boolean): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase();
};
