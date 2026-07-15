/**
 * Return values with duplicates removed, preserving first-seen order.
 *
 * @param {readonly T[]} values Values to de-duplicate.
 * @returns {T[]} Unique values.
 */
export const getUnique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));
