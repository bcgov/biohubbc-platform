import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../../../../errors/http-error';
import { SubmissionService } from '../../../../services/submission-service';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getSubmissionSignedUrl } from './getSignedUrl';

chai.use(sinonChai);

describe.only('getSubmissionSignedUrl', () => {
  afterEach(() => {
    sinon.restore();
  });

  const dbConnectionObj = getMockDBConnection();

  const sampleReq = {
    keycloak_token: {},
    params: {
      submissionId: 1
    }
  } as any;

  it('should return a signed URL upon success', async () => {
    const mockDBConnection = getMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const mockResponse = 'hello-world';

    sinon.stub(SubmissionService.prototype, 'getSubmissionRecordS3Key').resolves(mockResponse);

    const requestHandler = getSubmissionSignedUrl();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.jsonValue).to.eql(mockResponse);
  });

  it('should throw an error when submissionId is missing', async () => {
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    try {
      const result = getSubmissionSignedUrl();
      console.log('RES:', result)

      await result(
        { ...sampleReq, params: { ...sampleReq.params, submissionId: null } },
        (null as unknown) as any,
        (null as unknown) as any
      );

      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).status).to.equal(400);
      expect((actualError as HTTPError).message).to.equal('Missing required path param `submissionId`');
    }
  });
});
