import { ISearchFeaturePropertyCondition } from '../services/search-feature-service.interface';

/**
 * Normalizes a property condition value for consistent handling in search queries.
 *
 * @remarks
 * This function is necessary because `SearchFeaturePropertyCondition.value` can be:
 * - a single `string`, `number`, or `boolean`
 * - an array of strings and/or numbers (`(string | number)[]`)
 *
 * In the case of an array, it ensures that the value is homogeneous:
 * - If all elements are numbers → returned as `number[]`
 * - If all elements are strings → returned as `string[]`
 * - If mixed (some strings, some numbers) → all elements are converted to strings (`string[]`)
 *
 * Without normalization, a mixed array like `[1, "2"]` would be `(string | number)[]`,
 * which could break SQL comparisons or cause TypeScript type errors.
 *
 * Scalar values (`string | number | boolean`) are returned as-is.
 *
 * @example
 * normalizeSearchValue(42); // 42
 * normalizeSearchValue("foo"); // "foo"
 * normalizeSearchValue([1, 2, 3]); // [1, 2, 3]
 * normalizeSearchValue(["a", "b"]); // ["a", "b"]
 * normalizeSearchValue([1, "2", 3]); // ["1", "2", "3"]
 * normalizeSearchValue(true); // true
 *
 * @param val - The raw value from a `SearchFeaturePropertyCondition`
 * @returns The normalized value suitable for query builders:
 *          `string | number | boolean | string[] | number[]`
 */
export const normalizeSearchValue = (
  val: ISearchFeaturePropertyCondition['value']
): string | number | boolean | string[] | number[] => {
  if (Array.isArray(val)) {
    if (val.every((v): v is number => typeof v === 'number')) {
      return val; // number[]
    }
    if (val.every((v): v is string => typeof v === 'string')) {
      return val; // string[]
    }
    // Mixed array → normalize to string[]
    return val.map(String);
  }
  // Scalars returned as-is
  return val;
};

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
