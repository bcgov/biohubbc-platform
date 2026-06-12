import { formatSubmissionPropertyValue } from './search-result-utils';

describe('formatSubmissionPropertyValue', () => {
  it('returns an empty string for falsy values', () => {
    expect(formatSubmissionPropertyValue(null)).toBe('');
    expect(formatSubmissionPropertyValue(undefined)).toBe('');
    expect(formatSubmissionPropertyValue('')).toBe('');
    expect(formatSubmissionPropertyValue(0)).toBe('');
    expect(formatSubmissionPropertyValue(false)).toBe('');
  });

  it('formats truthy primitive values', () => {
    expect(formatSubmissionPropertyValue('wolf')).toBe('wolf');
    expect(formatSubmissionPropertyValue(12)).toBe('12');
    expect(formatSubmissionPropertyValue(true)).toBe('true');
  });

  it('formats arrays as comma-separated values', () => {
    expect(formatSubmissionPropertyValue(['wolf', 12, null, false, true])).toBe('wolf, 12, true');
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
});
