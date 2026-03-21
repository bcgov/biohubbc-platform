import { expect } from 'chai';
import { describe } from 'mocha';
import { splitTimestampValue } from './timestamp-utils';

describe('splitTimestampValue', () => {
  it('splits datetime values into date and time', () => {
    const result = splitTimestampValue('2024-05-10T14:32:00');

    expect(result).to.deep.equal({
      date: '2024-05-10',
      time: '14:32:00'
    });
  });

  it('supports date-only values', () => {
    const result = splitTimestampValue('2024-05-10');

    expect(result).to.deep.equal({
      date: '2024-05-10',
      time: null
    });
  });

  it('supports time-only values', () => {
    const result = splitTimestampValue('14:32:00');

    expect(result).to.deep.equal({
      date: null,
      time: '14:32:00'
    });
  });

  it('supports time-only values without seconds', () => {
    const result = splitTimestampValue('14:32');

    expect(result).to.deep.equal({
      date: null,
      time: '14:32:00'
    });
  });

  it('supports time-only values with milliseconds', () => {
    const result = splitTimestampValue('14:32:00.123');

    expect(result).to.deep.equal({
      date: null,
      time: '14:32:00'
    });
  });

  it('returns null components for invalid values', () => {
    const result = splitTimestampValue('not-a-time');

    expect(result).to.deep.equal({
      date: null,
      time: null
    });
  });
});
