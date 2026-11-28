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

/**
 * Normalize a case-insensitive identifier, such as a feature type name, for storage and comparison.
 *
 * Trims surrounding whitespace and lowercases the result, so a value matches its stored form whatever case or padding
 * the caller supplied.
 *
 * @param {string} value Identifier to normalize.
 * @returns {string} Trimmed, lowercase identifier.
 */
export const normalizeCase = (value: string): string => value.trim().toLowerCase();
