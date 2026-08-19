import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { JsonValue } from 'types/json';
import { safeJSONStringify } from './Utils';

/**
 * Determines whether a value is a plain (non-array, non-null) object.
 *
 * @param {unknown} value - Any property value.
 * @returns {boolean} `true` when the value is a plain object.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Determines whether a property value is a structured taxon reference.
 *
 * Taxon values are recognised by their identifier (`taxon_id`) alongside the display `label`, so plain
 * objects that merely carry a `label` key keep rendering as JSON.
 *
 * @param {unknown} value - Any property value.
 * @returns {boolean} `true` when the value is a taxon reference.
 */
export const isTaxonPropertyValue = (value: unknown): value is TaxonPropertyValue =>
  isPlainObject(value) && typeof value.label === 'string' && typeof value.taxon_id === 'number';

/**
 * Determines whether a property value is a structured reference value of any supported type.
 *
 * @param {unknown} value - Any property value.
 * @returns {boolean} `true` when the value is a structured reference value.
 */
export const isStructuredPropertyValue = (value: unknown): value is TaxonPropertyValue => isTaxonPropertyValue(value);

/**
 * Builds a content-derived key for a property value rendered in a list, so that React keys do not
 * depend solely on array position.
 *
 * Reference values key on their identifiers; every other value keys on its JSON text.
 *
 * @param {JsonValue} value - A single property value.
 * @returns {string} A key describing the value's identity.
 */
export const getPropertyValueKey = (value: JsonValue): string => {
  if (isTaxonPropertyValue(value)) {
    return `taxon:${value.taxon_id}`;
  }

  return `scalar:${safeJSONStringify(value)}`;
};
