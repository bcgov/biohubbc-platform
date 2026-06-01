import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureClosureRepository } from './submission-feature-closure-repository';

describe('SubmissionFeatureClosureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('computeClosureForUpload', () => {
    it('returns the INSERT row count (closure rows written)', async () => {
      const sqlStub = sinon.stub();
      sqlStub.onFirstCall().resolves(mockQueryResult([], 0)); // DELETE
      sqlStub.onSecondCall().resolves(mockQueryResult([], 5)); // INSERT
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(result).to.equal(5);
    });

    it('issues a DELETE then an INSERT (idempotent recompute) on the connection', async () => {
      const sqlSpy = sinon.spy(() => Promise.resolve(mockQueryResult([], 1)));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(sqlSpy).to.have.been.calledTwice;
      expect(sqlSpy.firstCall.args[0].text).to.match(/DELETE FROM submission_feature_closure/i);
      expect(sqlSpy.secondCall.args[0].text).to.match(/INSERT INTO submission_feature_closure/i);
    });

    it('returns 0 without throwing when no closure rows are written', async () => {
      const repository = new SubmissionFeatureClosureRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([], 0)) })
      );

      const result = await repository.computeClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(result).to.equal(0);
    });
  });
});
