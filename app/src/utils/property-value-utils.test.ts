import { CodePropertyValue, TaxonPropertyValue } from 'interfaces/property-value.interface';
import { describe, expect, it } from 'vitest';
import {
  getPropertyValueKey,
  isCodePropertyValue,
  isStructuredPropertyValue,
  isTaxonPropertyValue
} from './property-value-utils';

const taxon: TaxonPropertyValue = { taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' };
const code: CodePropertyValue = {
  codeset_key: 'sign',
  codeset_label: 'Sign',
  code_key: 'track',
  code_label: 'Track',
  label: 'Track'
};

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

describe('isCodePropertyValue', () => {
  it('recognises a code reference by its codeset and code keys and label', () => {
    expect(isCodePropertyValue(code)).toBe(true);
  });

  it('rejects other reference values and objects missing a key', () => {
    expect(isCodePropertyValue(taxon)).toBe(false);
    expect(isCodePropertyValue({ codeset_key: 'sign', label: 'Track' })).toBe(false);
    expect(isCodePropertyValue({ code_key: 'track', label: 'Track' })).toBe(false);
    expect(isCodePropertyValue('track')).toBe(false);
  });
});

describe('isStructuredPropertyValue', () => {
  it('accepts every supported reference value type', () => {
    expect(isStructuredPropertyValue(taxon)).toBe(true);
    expect(isStructuredPropertyValue(code)).toBe(true);
  });

  it('rejects objects that only carry a label', () => {
    expect(isStructuredPropertyValue({ label: 'structured value' })).toBe(false);
  });
});

describe('getPropertyValueKey', () => {
  it('keys reference values on their identifiers', () => {
    expect(getPropertyValueKey(taxon)).toBe('taxon:180543');
    expect(getPropertyValueKey(code)).toBe('code:sign:track');
  });

  it('keys other values on their JSON text', () => {
    expect(getPropertyValueKey('wolf')).toBe('scalar:"wolf"');
    expect(getPropertyValueKey({ type: 'Point', coordinates: [1, 2] })).toBe(
      'scalar:{"type":"Point","coordinates":[1,2]}'
    );
  });
});
