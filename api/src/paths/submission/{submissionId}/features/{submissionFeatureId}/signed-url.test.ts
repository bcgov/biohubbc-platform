import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../database/db';
import { HTTP400, HTTPError } from '../../../../../errors/http-error';
import { SubmissionService } from '../../../../../services/submission-service';
import { UserService } from '../../../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { getSubmissionFeatureSignedUrl } from './signed-url';

chai.use(sinonChai);

describe('getSubmissionFeatureSignedUrl', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('throws error if submissionService throws error', async () => {
    const dbConnectionObj = getMockDBConnection();

    const getDBConnectionStub = sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const getSubmissionFeatureSignedUrlStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatureSignedUrl')
      .throws(new HTTP400('Error', ['Error']));

    const isSystemUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

    const requestHandler = getSubmissionFeatureSignedUrl();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq['keycloak_token'] = 'TOKEN';

    mockReq.params = {
      submissionId: '1',
      submissionFeatureId: '2'
    };

    mockReq.query = {
      key: 'KEY',
      value: 'VALUE'
    };

    try {
      await requestHandler(mockReq, mockRes, mockNext);

      expect.fail();
    } catch (error) {
      expect(getDBConnectionStub).to.have.been.calledWith('TOKEN');
      expect(isSystemUserAdminStub).to.have.been.calledOnce;
      expect(getSubmissionFeatureSignedUrlStub).to.have.been.calledOnce;
      expect((error as HTTPError).status).to.equal(400);
      expect((error as HTTPError).message).to.equal('Error');
    }
  });

  it('should return 200 on success', async () => {
    const dbConnectionObj = getMockDBConnection();

    const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const mockResponse = [] as unknown as any;

    const getSubmissionFeatureSignedUrlStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatureSignedUrl')
      .resolves(mockResponse);

    const isSystemUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

    const requestHandler = getSubmissionFeatureSignedUrl();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: '1',
      submissionFeatureId: '2'
    };

    mockReq.query = {
      key: 'KEY',
      value: 'VALUE'
    };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
    expect(getSubmissionFeatureSignedUrlStub).to.have.been.calledOnce;
    expect(getSubmissionFeatureSignedUrlStub).to.have.been.calledWith({
      submissionFeatureId: 2,
      submissionFeatureObj: { key: 'KEY', value: 'VALUE' },
      isAdmin: false
    });
    expect(isSystemUserAdminStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql(mockResponse);
  });
});
