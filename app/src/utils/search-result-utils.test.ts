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

  it('formats reference values as their label', () => {
    expect(
      formatSubmissionPropertyValue({ taxon_id: 180543, tsn: 180543, rank: 'Species', label: 'Ursus americanus' })
    ).toBe('Ursus americanus');
  });

  it('flattens arrays of reference values into their labels', () => {
    expect(
      formatSubmissionPropertyValue([
        { taxon_id: 1, tsn: 1, rank: 'Species', label: 'Ursus americanus' },
        { taxon_id: 2, tsn: 2, rank: 'Species', label: 'Canis lupus' }
      ])
    ).toBe('Ursus americanus, Canis lupus');
  });
});
