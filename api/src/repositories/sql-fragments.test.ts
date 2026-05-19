import { expect } from 'chai';
import { describe, it } from 'mocha';
import { isAccessibleToUser } from './sql-fragments';

describe('sql-fragments', () => {
  describe('isAccessibleToUser', () => {
    it('requires active team records for scope grants', () => {
      const sql = isAccessibleToUser('wf.submission_feature_id').toLowerCase();

      expect(sql).to.include('join team t on t.team_id = tss.team_id');
      expect(sql).to.include('and t.record_end_date is null');
    });
  });
});
