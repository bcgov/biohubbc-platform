import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { HTTP400, HTTPError } from '../../../../../errors/http-error';
import { RelatedSubmissionFeature, SubmissionFeature } from '../../../../../repositories/submission-repository';
import { SubmissionFeatureService } from '../../../../../services/submission-feature-service';

chai.use(sinonChai);

describe('index', () => {
  describe('getSubmissionFeatureById', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('propogates and re-throws errors', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionFeatureByIdStub = sinon
        .stub(SubmissionFeatureService.prototype, 'getSubmissionFeatureById')
        .throws(new HTTP400('Error', ['Error']));

      sinon.stub(SubmissionFeatureService.prototype, 'getRelatedSubmissionFeatures').resolves([]);

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
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockFeature: SubmissionFeature = {
        submission_feature_id: 1,
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        urn: 'urn:1:feature:1',
        submission_id: 1,
        feature_type_id: 1,
        source_id: null,
        data: { key: 'value' },
        feature_type_name: 'sample_site',
        feature_type_display_name: 'Sample Site',
        submission_name: 'Test Submission',
        secured: true,
        security_reasons: ['Moose']
      };

      const mockRelatedFeatures: RelatedSubmissionFeature[] = [
        {
          submission_feature_id: 2,
          feature_type_name: 'observation',
          feature_type_display_name: 'Observation',
          data: { name: 'Observation A' }
        }
      ];

      const getSubmissionFeatureByIdStub = sinon
        .stub(SubmissionFeatureService.prototype, 'getSubmissionFeatureById')
        .resolves(mockFeature);

      const getRelatedSubmissionFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'getRelatedSubmissionFeatures')
        .resolves(mockRelatedFeatures);

      const requestHandler = index.getSubmissionFeatureById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionFeatureId: '1'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSubmissionFeatureByIdStub).to.have.been.calledOnceWith(1);
      expect(getRelatedSubmissionFeaturesStub).to.have.been.calledOnceWith(1);
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({ feature: mockFeature, relatedFeatures: mockRelatedFeatures });
    });

    it('uses the API user connection for anonymous (no token) requests', async () => {
      const dbConnectionObj = getMockDBConnection();
      const getAPIUserDBConnectionStub = sinon
        .stub(db.dbDependencies, 'getAPIUserDBConnection')
        .returns(dbConnectionObj);
      const getDBConnectionStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(SubmissionFeatureService.prototype, 'getSubmissionFeatureById').resolves({} as SubmissionFeature);
      sinon.stub(SubmissionFeatureService.prototype, 'getRelatedSubmissionFeatures').resolves([]);

      const requestHandler = index.getSubmissionFeatureById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      // No keycloak_token on the request => anonymous caller reading an unsecured feature.
      mockReq.params = {
        submissionFeatureId: '1'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      expect(getDBConnectionStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.eql(200);
    });
  });
});
