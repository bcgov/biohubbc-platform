import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import * as db from '../../../../database/db';
import { ApiError } from '../../../../errors/api-error';
import { HTTP400, HTTPError } from '../../../../errors/http-error';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('getSubmissionFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('throws error and rolls back if SubmissionService throws', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'rollback').resolves();
    sinon.stub(connection, 'release').resolves();

    sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatures')
      .throws(new HTTP400('Service error', ['Service error']));
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturesCount').resolves(0);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '1' };

    try {
      await requestHandler(mockReq, mockRes, () => {});
      expect.fail('Expected handler to throw');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTPError);
      expect((error as HTTPError).status).to.equal(400);
      expect(connection.rollback).to.have.been.calledOnce;
      expect(connection.release).to.have.been.calledOnce;
    }
  });

  it('returns 200 with paginated features on success', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'rollback').resolves();
    sinon.stub(connection, 'release').resolves();

    const mockFeatures = [
      { submission_id: 1, submission_feature_id: 2, feature_type_name: 'test', feature_type_id: 3, secured: true }
    ];
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeatures').resolves(mockFeatures);
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturesCount').resolves(1);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '1' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.have.keys(['features', 'pagination']);
    expect(mockRes.jsonValue.features).to.eql(mockFeatures);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('passes search to service methods', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'rollback').resolves();
    sinon.stub(connection, 'release').resolves();

    const mockFeatures = [
      {
        submission_id: 1,
        submission_feature_id: 2,
        feature_type_name: 'observation',
        feature_type_id: 3,
        secured: true
      }
    ];
    const getSubmissionFeaturesStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatures')
      .resolves(mockFeatures);
    const getSubmissionFeaturesCountStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeaturesCount')
      .resolves(1);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '1' };
    mockReq.query = { search: 'obs', page: '1', limit: '10' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(getSubmissionFeaturesStub).to.have.been.calledOnce;
    expect(getSubmissionFeaturesStub.firstCall.args[2]).to.deep.equal({ search: 'obs' });
    expect(getSubmissionFeaturesCountStub).to.have.been.calledOnceWith(1, { search: 'obs' });
    expect(mockRes.statusValue).to.equal(200);
  });

  it('releases connection even if commit fails', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').rejects(new Error('Commit failed'));
    sinon.stub(connection, 'rollback').resolves();
    sinon.stub(connection, 'release').resolves();

    const mockFeatures = [
      { submission_id: 1, submission_feature_id: 2, feature_type_name: 'test', feature_type_id: 3, secured: true }
    ];
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeatures').resolves(mockFeatures);
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturesCount').resolves(1);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '1' };

    try {
      await requestHandler(mockReq, mockRes, () => {});
      expect.fail('Expected handler to throw');
    } catch (error) {
      expect((error as ApiError).message).to.equal('Commit failed');
      expect(connection.release).to.have.been.calledOnce;
    }
  });
});
