import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissionUploadFeatureTypeProperties } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../../database/db';
import { SubmissionFeaturePropertyService } from '../../../../../../../../../services/submission-feature-property-service';

chai.use(sinonChai);

describe('getSubmissionUploadFeatureTypeProperties endpoint', () => {
  afterEach(() => sinon.restore());

  it('returns the upload feature-type definitions and commits', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const release = sinon.stub(connection, 'release');
    const operation = sinon
      .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionUploadFeatureTypeProperties')
      .resolves([]);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '16', submissionUploadId: 'upload-id', featureType: 'Animal' };
    await getSubmissionUploadFeatureTypeProperties()(mockReq, mockRes, () => {});
    expect(operation).to.have.been.calledOnceWith(16, 'upload-id', 'animal');
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.deep.equal({ properties: [] });
    expect(commit).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });

  it('rolls back and releases when loading definitions fails', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const commit = sinon.stub(connection, 'commit').resolves();
    const rollback = sinon.stub(connection, 'rollback').resolves();
    const release = sinon.stub(connection, 'release');
    const error = new Error('Read failed');
    sinon.stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionUploadFeatureTypeProperties').rejects(error);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '16', submissionUploadId: 'upload-id', featureType: 'animal' };
    try {
      await getSubmissionUploadFeatureTypeProperties()(mockReq, mockRes, () => {});
      expect.fail('Expected error');
    } catch (actual) {
      expect(actual).to.equal(error);
    }
    expect(commit).not.to.have.been.called;
    expect(rollback).to.have.been.calledOnce;
    expect(release).to.have.been.calledOnce;
  });
});
