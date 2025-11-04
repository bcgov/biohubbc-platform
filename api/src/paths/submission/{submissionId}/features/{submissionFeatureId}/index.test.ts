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
  describe('getSubmissionFeatureById', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('propogates and re-throws errors', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionFeatureByIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionFeatureById')
        .throws(new HTTP400('Error', ['Error']));

      const requestHandler = index.getSubmissionFeatureById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionFeatureId: '1'
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(getSubmissionFeatureByIdStub).to.have.been.calledOnceWith(1);
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Error');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockFeature = { id: 1, name: 'Feature 1' };
      const getSubmissionFeatureByIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionFeatureById')
        .resolves(mockFeature);

      const requestHandler = index.getSubmissionFeatureById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionFeatureId: '1'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSubmissionFeatureByIdStub).to.have.been.calledOnceWith(1);
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({ feature: mockFeature });
    });
  });
});
