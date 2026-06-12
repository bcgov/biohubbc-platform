import { formatSubmissionPropertyValue } from './search-result-utils';

describe('formatSubmissionPropertyValue', () => {
  it('returns an empty string for nullish values', () => {
    expect(formatSubmissionPropertyValue(null)).toBe('');
    expect(formatSubmissionPropertyValue(undefined)).toBe('');
  });

  it('formats primitive values', () => {
    expect(formatSubmissionPropertyValue('wolf')).toBe('wolf');
    expect(formatSubmissionPropertyValue(12)).toBe('12');
    expect(formatSubmissionPropertyValue(false)).toBe('false');
  });

  it('formats arrays as comma-separated values', () => {
    expect(formatSubmissionPropertyValue(['wolf', 12, null, false])).toBe('wolf, 12, false');
  });

  it('formats objects as JSON', () => {
    expect(formatSubmissionPropertyValue({ type: 'Point', coordinates: [1, 2] })).toBe(
      '{"type":"Point","coordinates":[1,2]}'
    );
  });

  it('does not fall back to default object stringification for unstringifiable objects', () => {
    const circularValue: Record<string, unknown> = { name: 'loop' };
    circularValue.self = circularValue;

    expect(formatSubmissionPropertyValue(circularValue)).toBe('');
  });
});
