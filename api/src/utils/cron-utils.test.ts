import { expect } from 'chai';
import { describe } from 'mocha';
import { computeNextRunDate } from './cron-utils';

describe('cron-utils', () => {
  describe('computeNextRunDate', () => {
    it('returns an occurrence strictly after `from` even when `from` sits exactly on a tick', () => {
      // Verifies: parsing with currentDate: from makes .next() the first occurrence STRICTLY after
      // from, so a completed run can never re-select the same tick on the next poll.
      const from = new Date('2026-01-15T02:00:00Z');

      const result = computeNextRunDate('0 2 * * *', 'UTC', from);

      expect(new Date(result).getTime()).to.be.greaterThan(from.getTime());
    });

    it('interprets the cron fields in the given IANA timezone', () => {
      // January = no DST ambiguity. `0 2 * * *` means 02:00 local wall-clock.
      // Vancouver standard time is UTC-8, so 02:00 Vancouver = 10:00Z; 02:00 UTC = 02:00Z.
      // The two must differ, and by exactly the 8-hour Vancouver standard-time offset.
      const from = new Date('2026-01-15T00:00:00Z');

      const vancouver = computeNextRunDate('0 2 * * *', 'America/Vancouver', from);
      const utc = computeNextRunDate('0 2 * * *', 'UTC', from);

      expect(vancouver).to.not.equal(utc);

      const vancouverDate = new Date(vancouver);
      const utcDate = new Date(utc);

      // 02:00Z and 10:00Z are both on 2026-01-15; the difference is exactly 8 hours.
      const eightHoursMs = 8 * 60 * 60 * 1000;
      expect(vancouverDate.getTime() - utcDate.getTime()).to.equal(eightHoursMs);

      // And the absolute instants are the expected wall-clock-in-zone moments.
      expect(utcDate.getTime()).to.equal(new Date('2026-01-15T02:00:00Z').getTime());
      expect(vancouverDate.getTime()).to.equal(new Date('2026-01-15T10:00:00Z').getTime());
    });

    it('returns a UTC ISO 8601 string that round-trips', () => {
      // Verifies: the return is the contract type — a string that is a canonical ISO timestamp.
      const result = computeNextRunDate('0 2 * * *', 'UTC', new Date('2026-01-15T00:00:00Z'));

      expect(result).to.be.a('string');
      expect(new Date(result).toISOString()).to.equal(result);
      expect(result).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });

    it('throws on an invalid cron expression', () => {
      expect(() => computeNextRunDate('not a cron', 'UTC', new Date('2026-01-15T00:00:00Z'))).to.throw();
    });

    it('throws on an unknown timezone', () => {
      expect(() => computeNextRunDate('0 2 * * *', 'Not/AZone', new Date('2026-01-15T00:00:00Z'))).to.throw();
    });
  });
});
