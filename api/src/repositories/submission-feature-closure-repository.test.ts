import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureClosureRepository } from './submission-feature-closure-repository';

chai.use(sinonChai);

describe('SubmissionFeatureClosureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('deleteClosureForUpload', () => {
    it('issues a single DELETE on the connection', async () => {
      const sqlSpy = sinon.spy(() => Promise.resolve(mockQueryResult([], 1)));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.deleteClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(sqlSpy).to.have.been.calledOnce;
      expect(sqlSpy.firstCall.args[0].text).to.match(/DELETE FROM submission_feature_closure/i);
    });
  });

  describe('computeClosureForUpload', () => {
    it('issues a single INSERT and returns the row count (closure rows written)', async () => {
      const sqlSpy = sinon.spy(() => Promise.resolve(mockQueryResult([], 5)));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      const result = await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(sqlSpy).to.have.been.calledOnce;
      expect(sqlSpy.firstCall.args[0].text).to.match(/INSERT INTO submission_feature_closure/i);
      expect(result).to.equal(5);
    });

    it('returns 0 without throwing when no closure rows are written', async () => {
      const repository = new SubmissionFeatureClosureRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([], 0)) })
      );

      const result = await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(result).to.equal(0);
    });

    it('does not require record_effective_date when selecting features for closure', async () => {
      const sqlSpy = sinon.spy(() => Promise.resolve(mockQueryResult([], 1)));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      const sqlText = sqlSpy.firstCall.args[0].text;
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(sqlText).to.not.include('record_effective_date <= now()');
    });
  });
});
