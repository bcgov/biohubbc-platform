/**
 * Normalize optional text values for persistence.
 *
 * Trims surrounding whitespace and optionally lowercases the result.
 * Returns null when value is undefined, null, non-string, or empty after trim.
 *
 * @param {unknown} value
 * @param {boolean} [toLowerCase=false]
 * @returns {(string | null)}
 */
export const normalizeOptionalText = (value: unknown, toLowerCase = false): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim();
  return toLowerCase ? normalizedValue.toLowerCase() : normalizedValue;
};
