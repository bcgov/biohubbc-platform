import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getReconciliationFeatures } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../database/db';
import { SearchFeatureService } from '../../../../../../../../../services/search-feature-service';

chai.use(sinonChai);

describe('getReconciliationFeatures endpoint', () => {
  afterEach(() => sinon.restore());

  it('returns scoped reconciliation data and commits and releases its connection', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const release = sinon.stub(connection, 'release');
    const result = {
      features: [],
      properties: [],
      pagination: { limit: 10, sort: 'relevancy_score', order: 'desc', next_cursor: null, previous_cursor: null }
    };
    const operation = sinon.stub(SearchFeatureService.prototype, 'getReconciliationFeatures').resolves(result as any);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '7',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'unmodified'
    };
    mockReq.body = { featureType: 'animal', pagination: { limit: 10 } };
    await getReconciliationFeatures()(mockReq, mockRes, () => {});
    expect(operation.firstCall.args[0]).to.deep.equal({
      submissionId: 7,
      submissionUploadId: mockReq.params.submissionUploadId,
      reconciliation: 'unmodified'
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal(result);
    expect(commit).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });

  for (const body of [{ featureType: ' ' }, { featureType: 'animal', pagination: { cursor: 'invalid' } }]) {
    it(`rejects invalid search inputs before accessing feature data: ${JSON.stringify(body)}`, async () => {
      const connection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
      const operation = sinon.stub(SearchFeatureService.prototype, 'getReconciliationFeatures');
      const rollback = sinon.stub(connection, 'rollback').resolves();
      const release = sinon.stub(connection, 'release');
      const { mockReq, mockRes } = getRequestHandlerMocks();
      mockReq.params = {
        submissionId: '7',
        submissionUploadId: '11111111-1111-4111-8111-111111111111',
        reconciliation: 'new'
      };
      mockReq.body = body;
      try {
        await getReconciliationFeatures()(mockReq, mockRes, () => {});
        expect.fail('Expected invalid input rejection');
      } catch (error) {
        expect((error as Error).message).to.match(/Feature type is required|Invalid search result cursor/);
      }
      expect(operation).not.to.have.been.called;
      expect(rollback).to.have.been.calledOnce;
      expect(release).to.have.been.calledOnce;
    });
  }

  it('rolls back and releases on failure without committing', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const rollback = sinon.stub(connection, 'rollback').resolves();
    const release = sinon.stub(connection, 'release');
    const error = new Error('Query failed');
    sinon.stub(SearchFeatureService.prototype, 'getReconciliationFeatures').rejects(error);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '7',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'new'
    };
    mockReq.body = { featureType: 'animal' };
    try {
      await getReconciliationFeatures()(mockReq, mockRes, () => {});
      expect.fail('Expected failure');
    } catch (actual) {
      expect(actual).to.equal(error);
    }
    expect(commit).not.to.have.been.called;
    expect(rollback).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });
});
