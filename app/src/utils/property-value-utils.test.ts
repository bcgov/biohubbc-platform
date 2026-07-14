import { CodePropertyValue, FeaturePropertyValue, TaxonPropertyValue } from 'interfaces/useFeaturesApi.interface';
import { isCodeValue, isFeatureValue, isStructuredPropertyValue, isTaxonValue } from './property-value-utils';

const taxon: TaxonPropertyValue = { taxon_id: 180543, tsn: 180543, rank: 'species', label: 'Ursus americanus' };
const code: CodePropertyValue = {
  codeset_key: 'sign',
  codeset_label: 'Sign',
  code_key: 'track',
  code_label: 'Track',
  label: 'Track'
};
const feature: FeaturePropertyValue = { urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' };

describe('isStructuredPropertyValue', () => {
  it('detects reference-typed values', () => {
    expect(isStructuredPropertyValue(taxon)).toBe(true);
    expect(isStructuredPropertyValue(code)).toBe(true);
    expect(isStructuredPropertyValue(feature)).toBe(true);
  });

  it('rejects scalars, arrays, and nullish values', () => {
    expect(isStructuredPropertyValue('wolf')).toBe(false);
    expect(isStructuredPropertyValue(12)).toBe(false);
    expect(isStructuredPropertyValue(null)).toBe(false);
    expect(isStructuredPropertyValue(undefined)).toBe(false);
    expect(isStructuredPropertyValue(['a', 'b'])).toBe(false);
  });

  it('rejects objects without a discriminator (GeoJSON, generic nested objects)', () => {
    expect(isStructuredPropertyValue({ type: 'Point', coordinates: [1, 2] })).toBe(false);
    expect(isStructuredPropertyValue({ label: 'structured value', meta: { count: 2 } })).toBe(false);
  });
});

describe('reference-value discriminators', () => {
  it('identifies the specific reference type', () => {
    expect(isFeatureValue(feature)).toBe(true);
    expect(isTaxonValue(taxon)).toBe(true);
    expect(isCodeValue(code)).toBe(true);

    expect(isFeatureValue(taxon)).toBe(false);
    expect(isTaxonValue(code)).toBe(false);
    expect(isCodeValue(feature)).toBe(false);
  });
});
