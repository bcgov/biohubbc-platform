import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { describe, expect, it } from 'vitest';
import { getPropertyValueKey, isStructuredPropertyValue, isTaxonPropertyValue } from './property-value-utils';

const taxon: TaxonPropertyValue = { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' };

describe('isTaxonPropertyValue', () => {
  it('recognises a taxon reference by its identifier and label', () => {
    expect(isTaxonPropertyValue(taxon)).toBe(true);
    expect(isTaxonPropertyValue({ ...taxon, rank: null })).toBe(true);
  });

  it('rejects scalars, arrays, nullish values and objects without the taxon identifier', () => {
    expect(isTaxonPropertyValue('wolf')).toBe(false);
    expect(isTaxonPropertyValue(12)).toBe(false);
    expect(isTaxonPropertyValue(null)).toBe(false);
    expect(isTaxonPropertyValue(undefined)).toBe(false);
    expect(isTaxonPropertyValue([taxon])).toBe(false);
    expect(isTaxonPropertyValue({ label: 'structured value', meta: { count: 2 } })).toBe(false);
    expect(isTaxonPropertyValue({ type: 'Point', coordinates: [1, 2] })).toBe(false);
  });
});

describe('isStructuredPropertyValue', () => {
  it('accepts every supported reference value type', () => {
    expect(isStructuredPropertyValue(taxon)).toBe(true);
  });

  it('rejects objects that only carry a label', () => {
    expect(isStructuredPropertyValue({ label: 'structured value' })).toBe(false);
  });
});

describe('getPropertyValueKey', () => {
  it('keys reference values on their identifiers', () => {
    expect(getPropertyValueKey(taxon)).toBe('taxon:180543');
  });

  it('keys other values on their JSON text', () => {
    expect(getPropertyValueKey('wolf')).toBe('scalar:"wolf"');
    expect(getPropertyValueKey({ type: 'Point', coordinates: [1, 2] })).toBe(
      'scalar:{"type":"Point","coordinates":[1,2]}'
    );
  });
});
