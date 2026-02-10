import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { DownloadFragmentRepository } from './download-fragment-repository';

chai.use(sinonChai);

describe('DownloadFragmentRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadFragmentFeatures', () => {
    it('inserts join table rows for each feature ID using unnest', async () => {
      // Verifies: SQL uses parameterized unnest with the feature ID array

      // Step 1: Setup sql stub to capture the query
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository and call method
      const repo = new DownloadFragmentRepository(mockDBConnection);
      await repo.createDownloadFragmentFeatures(5, [10, 20, 30]);

      // Step 3: Verify sql uses unnest and passes parameters correctly
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('unnest');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(5);
      expect(sqlValues).to.deep.include([10, 20, 30]);
    });

    it('does nothing when featureIds array is empty', async () => {
      // Verifies: Early return prevents empty INSERT statement

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository and call with empty array
      const repo = new DownloadFragmentRepository(mockDBConnection);
      await repo.createDownloadFragmentFeatures(5, []);

      // Step 3: Verify sql was NOT called
      expect(sqlStub).to.not.have.been.called;
    });
  });

  // Note: streamFragmentFeaturesByType parent denormalization is tested via DB integration tests
  // (see api/src/__integration__/db/) which verify actual query behavior with real data
});
