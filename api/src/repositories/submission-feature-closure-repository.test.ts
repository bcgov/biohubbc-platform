import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureClosureRepository } from './submission-feature-closure-repository';

describe('SubmissionFeatureClosureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('rebuildClosureForUpload', () => {
    it('returns the inserted_count from the returned row', async () => {
      const repository = new SubmissionFeatureClosureRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([{ inserted_count: 5 }])) })
      );

      const result = await repository.rebuildClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(result).to.equal(5);
    });

    it('invokes connection.sql exactly once', async () => {
      const sqlSpy = sinon.spy(() => Promise.resolve(mockQueryResult([{ inserted_count: 5 }])));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.rebuildClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(sqlSpy).to.have.been.calledOnce;
    });

    it('returns 0 without throwing when no closure rows are written', async () => {
      const repository = new SubmissionFeatureClosureRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([{ inserted_count: 0 }])) })
      );

      const result = await repository.rebuildClosureForUpload('11111111-1111-1111-1111-111111111111');

      expect(result).to.equal(0);
    });
  });
});
