/**
 * Sorts autocomplete options so selected values are prepended without duplicates.
 *
 * @template T
 * @param {readonly T[]} selectedOptions
 * @param {readonly T[]} remainingOptions
 * @return {T[]}
 */
export const sortAutocompleteOptions = <T extends { value: string | number }>(
  selectedOptions: readonly T[],
  remainingOptions: readonly T[]
): T[] => {
  const selectedValues = new Set(selectedOptions.map((item) => item.value));

  return [...selectedOptions, ...remainingOptions.filter((item) => !selectedValues.has(item.value))];
};
