import {
  CodePropertyValue,
  FeaturePropertyValue,
  StructuredPropertyValue,
  TaxonPropertyValue
} from 'interfaces/useFeaturesApi.interface';

/**
 * Determines whether a property value is a reference-typed structured value (taxon, code, or
 * feature).
 *
 * A structured value is a non-array object exposing a readable `label` alongside a known
 * discriminator (`urn`, `taxon_id`, or a code key). Plain objects, GeoJSON, and arbitrary nested
 * values that merely happen to contain a `label` are intentionally excluded so they continue to
 * render/stringify as before.
 *
 * @param {unknown} value - A raw property value.
 * @returns {boolean} `true` when the value is a structured reference value.
 */
export const isStructuredPropertyValue = (value: unknown): value is StructuredPropertyValue => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.label === 'string' &&
    (typeof candidate.urn === 'string' ||
      typeof candidate.taxon_id === 'number' ||
      typeof candidate.code_key === 'string' ||
      typeof candidate.codeset_key === 'string')
  );
};

/**
 * Determines whether a structured value is a feature reference.
 *
 * @param {StructuredPropertyValue} value - A structured reference value.
 * @returns {boolean} `true` when the value is a feature reference.
 */
export const isFeatureValue = (value: StructuredPropertyValue): value is FeaturePropertyValue =>
  typeof (value as FeaturePropertyValue).urn === 'string';

/**
 * Determines whether a structured value is a taxon reference.
 *
 * @param {StructuredPropertyValue} value - A structured reference value.
 * @returns {boolean} `true` when the value is a taxon reference.
 */
export const isTaxonValue = (value: StructuredPropertyValue): value is TaxonPropertyValue =>
  typeof (value as TaxonPropertyValue).taxon_id === 'number';

/**
 * Determines whether a structured value is a code reference.
 *
 * @param {StructuredPropertyValue} value - A structured reference value.
 * @returns {boolean} `true` when the value is a code reference.
 */
export const isCodeValue = (value: StructuredPropertyValue): value is CodePropertyValue =>
  typeof (value as CodePropertyValue).code_key === 'string' ||
  typeof (value as CodePropertyValue).codeset_key === 'string';
