import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getReconciliationFeatureData } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../database/db';
import { SubmissionUploadReconciliationService } from '../../../../../../../../../services/reconciliation/submission-upload-reconciliation-service';

chai.use(sinonChai);

describe('getReconciliationFeatureData', () => {
  afterEach(() => sinon.restore());

  it('returns a page of raw feature data for the outcome', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'release').resolves();

    const page = {
      features: [{ submission_feature_id: 3, data: { id: 'A', type: 'survey', properties: {} } }],
      pagination: { total: 1, per_page: 10, current_page: 2, last_page: 1, sort: undefined, order: 'desc' as const }
    };
    const getData = sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'getReconciliationFeatureData')
      .resolves(page);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'modified'
    };
    mockReq.query = { page: '2', limit: '10', order: 'desc' };

    await getReconciliationFeatureData()(mockReq, mockRes, () => {});

    expect(getData).to.have.been.calledOnceWithExactly(
      { submissionId: 16, submissionUploadId: mockReq.params.submissionUploadId, reconciliation: 'modified' },
      { page: 2, limit: 10, sort: undefined, order: 'desc' }
    );
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(page);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rolls back and releases when the read fails', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'rollback').resolves();
    sinon.stub(connection, 'release').resolves();
    sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'getReconciliationFeatureData')
      .rejects(new Error('read failed'));
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111',
      reconciliation: 'new'
    };

    try {
      await getReconciliationFeatureData()(mockReq, mockRes, () => {});
      expect.fail('Expected the read to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('read failed');
    }

    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
