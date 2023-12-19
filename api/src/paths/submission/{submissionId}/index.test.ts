import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTP400, HTTPError } from '../../../errors/http-error';
import { SECURITY_APPLIED_STATUS } from '../../../repositories/security-repository';
import { SubmissionService } from '../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as index from './index';

chai.use(sinonChai);

describe('index', () => {
  describe('getSubmissionInformation', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws error if submissionService throws error', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionAndFeaturesBySubmissionId')
        .throws(new HTTP400('Error', ['Error']));

      const requestHandler = index.getSubmissionInformation();

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

      const mockResponse = {
        submission: {
          submission_id: 1,
          uuid: 'string',
          security_review_timestamp: null,
          submitted_timestamp: 'string',
          source_system: 'string',
          name: 'string',
          description: null,
          create_date: 'string',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.SECURED
        },
        submissionFeatures: []
      };

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionAndFeaturesBySubmissionId')
        .resolves(mockResponse);

      const requestHandler = index.getSubmissionInformation();

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
