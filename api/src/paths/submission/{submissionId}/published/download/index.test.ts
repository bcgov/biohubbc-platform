import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import * as db from '../../../../../database/db';
import { HTTP400, HTTPError } from '../../../../../errors/http-error';
import { SubmissionService } from '../../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';

chai.use(sinonChai);

describe('index', () => {
  describe('downloadPublishedSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws error if submissionService throws error', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'downloadPublishedSubmission')
        .throws(new HTTP400('Error', ['Error']));

      const requestHandler = index.downloadPublishedSubmission();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1'
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect(getSubmissionAndFeaturesBySubmissionIdStub).to.have.been.calledOnce;
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Error');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockResponse = [] as unknown as any;

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'downloadPublishedSubmission')
        .resolves(mockResponse);

      const requestHandler = index.downloadPublishedSubmission();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSubmissionAndFeaturesBySubmissionIdStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
