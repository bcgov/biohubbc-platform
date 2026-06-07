import { expect } from 'chai';
import { describe } from 'mocha';
import { parseTimestamp } from './timestamp';

describe('parseTimestamp', () => {
  it('parses valid date, time, and datetime scalar values', () => {
    expect(parseTimestamp('2024-02-29')).to.eql({
      kind: 'date',
      date_value: '2024-02-29',
      time_value: null
    });

    expect(parseTimestamp('14:30:00-07:00')).to.eql({
      kind: 'time',
      date_value: null,
      time_value: '14:30:00-07:00'
    });

    expect(parseTimestamp('2024-02-29T14:30:00Z')).to.eql({
      kind: 'datetime',
      date_value: '2024-02-29',
      time_value: '14:30:00Z'
    });
  });

  it('parses short UTC offset forms (+HH / -HH)', () => {
    expect(parseTimestamp('14:30:00+00')).to.eql({
      kind: 'time',
      date_value: null,
      time_value: '14:30:00+00'
    });

    expect(parseTimestamp('14:30:00-07')).to.eql({
      kind: 'time',
      date_value: null,
      time_value: '14:30:00-07'
    });

    expect(parseTimestamp('2024-02-29T14:30:00+00')).to.eql({
      kind: 'datetime',
      date_value: '2024-02-29',
      time_value: '14:30:00+00'
    });

    expect(parseTimestamp('2024-02-29T14:30:00-07')).to.eql({
      kind: 'datetime',
      date_value: '2024-02-29',
      time_value: '14:30:00-07'
    });
  });

  it('rejects invalid calendar dates and times', () => {
    expect(parseTimestamp('2024-02-31')).to.equal(null);
    expect(parseTimestamp('2024-13-01')).to.equal(null);
    expect(parseTimestamp('24:00:00')).to.equal(null);
    expect(parseTimestamp('14:99:00')).to.equal(null);
    expect(parseTimestamp('2024-02-31T14:30:00Z')).to.equal(null);
    expect(parseTimestamp('2024-02-29T24:00:00Z')).to.equal(null);
  });
});
