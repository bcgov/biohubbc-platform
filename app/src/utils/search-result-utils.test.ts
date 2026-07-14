import { formatSubmissionPropertyValue } from './search-result-utils';

describe('formatSubmissionPropertyValue', () => {
  it('returns an empty string for absent values', () => {
    expect(formatSubmissionPropertyValue(null)).toBe('');
    expect(formatSubmissionPropertyValue(undefined)).toBe('');
  });

  it('formats primitive values', () => {
    expect(formatSubmissionPropertyValue('')).toBe('');
    expect(formatSubmissionPropertyValue('wolf')).toBe('wolf');
    expect(formatSubmissionPropertyValue(0)).toBe('0');
    expect(formatSubmissionPropertyValue(12)).toBe('12');
    expect(formatSubmissionPropertyValue(false)).toBe('false');
    expect(formatSubmissionPropertyValue(true)).toBe('true');
  });

  it('formats arrays as comma-separated values', () => {
    expect(formatSubmissionPropertyValue(['wolf', 12, null, false, true])).toBe('wolf, 12, false, true');
  });

  it('formats objects as JSON', () => {
    expect(formatSubmissionPropertyValue({ type: 'Point', coordinates: [1, 2] })).toBe(
      '{"type":"Point","coordinates":[1,2]}'
    );
  });

  it('formats nested JSON objects as JSON', () => {
    expect(formatSubmissionPropertyValue({ label: 'structured value', meta: { count: 2 } })).toBe(
      '{"label":"structured value","meta":{"count":2}}'
    );
  });

  it('returns the label for reference-typed structured values', () => {
    expect(formatSubmissionPropertyValue({ urn: 'urn:18:sample_site:3339', label: 'urn:18:sample_site:3339' })).toBe(
      'urn:18:sample_site:3339'
    );
    expect(
      formatSubmissionPropertyValue({ taxon_id: 180543, tsn: 180543, rank: 'species', label: 'Ursus americanus' })
    ).toBe('Ursus americanus');
    expect(formatSubmissionPropertyValue({ codeset_key: 'sign', code_key: 'track', label: 'Track' })).toBe('Track');
  });

  it('flattens arrays of reference-typed values using their labels', () => {
    expect(
      formatSubmissionPropertyValue([
        { taxon_id: 1, label: 'Ursus americanus' },
        { taxon_id: 2, label: 'Canis lupus' }
      ])
    ).toBe('Ursus americanus, Canis lupus');
  });
});
