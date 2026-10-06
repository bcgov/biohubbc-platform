import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { countReconciliationFeatures } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../../database/db';
import { SearchFeatureService } from '../../../../../../../../../../services/search-feature-service';

chai.use(sinonChai);

describe('countReconciliationFeatures endpoint', () => {
  afterEach(() => sinon.restore());

  it('returns scoped reconciliation data and commits and releases its connection', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const release = sinon.stub(connection, 'release');
    const result = { total: 2, feature_types: [{ feature_type_name: 'animal', count: 2 }] };
    const operation = sinon.stub(SearchFeatureService.prototype, 'countReconciliationFeatures').resolves(result as any);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '7',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'unmodified'
    };
    mockReq.body = { featureType: 'animal', pagination: { limit: 10 } };
    await countReconciliationFeatures()(mockReq, mockRes, () => {});
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

  it('rolls back and releases on failure without committing', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const rollback = sinon.stub(connection, 'rollback').resolves();
    const release = sinon.stub(connection, 'release');
    const error = new Error('Query failed');
    sinon.stub(SearchFeatureService.prototype, 'countReconciliationFeatures').rejects(error);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '7',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'new'
    };
    mockReq.body = { featureType: 'animal' };
    try {
      await countReconciliationFeatures()(mockReq, mockRes, () => {});
      expect.fail('Expected failure');
    } catch (actual) {
      expect(actual).to.equal(error);
    }
    expect(commit).not.to.have.been.called;
    expect(rollback).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });
});
