import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissionFeatureTypes } from '.';
import * as db from '../../../../database/db';
import { FeatureTypeRecord } from '../../../../repositories/submission-repository';
import { SubmissionService } from '../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('getSubmissionFeatureTypes', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('throws error if submissionService throws error', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const getSubmissionFeatureTypesStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatureTypes')
      .throws(new Error('test error'));

    const requestHandler = getSubmissionFeatureTypes();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const submissionId = 1;

    mockReq.params = {
      submissionId: String(submissionId)
    };

    try {
      await requestHandler(mockReq, mockRes, mockNext);

      expect.fail();
    } catch (error) {
      expect(getSubmissionFeatureTypesStub).to.have.been.calledOnceWith(submissionId);
      expect((error as Error).message).to.equal('test error');
    }
  });

  it('should return 200 on success', async () => {
    const dbConnectionObj = getMockDBConnection();

    sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

    const mockFeatureTypes: FeatureTypeRecord[] = [];

    const getSubmissionFeatureTypesStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeatureTypes')
      .resolves(mockFeatureTypes);

    const requestHandler = getSubmissionFeatureTypes();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const submissionId = 1;

    mockReq.params = {
      submissionId: String(submissionId)
    };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getSubmissionFeatureTypesStub).to.have.been.calledOnceWith(submissionId);
    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql({ feature_types: mockFeatureTypes });
  });
});
