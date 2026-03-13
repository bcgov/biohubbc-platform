import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { RegionService } from '../../services/region-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { SubmissionService } from '../../services/submission-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadService } from '../../services/upload/upload-service';
import { ValidationService } from '../../services/validation-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as intake from './intake';

chai.use(sinonChai);

describe('intake', () => {
  describe('submissionIntake', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws error if validationService returns false', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const validateSubmissionFeaturesStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatures')
        .resolves(false);

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        id: '123-456-789',
        type: 'submission',
        properties: {},
        child_features: []
      };
      mockReq.keycloak_token = { clientId: 'sims-service-client' };
      mockReq.system_user = { system_user_id: 3 };
      mockReq.contributor_id = 11;

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect(validateSubmissionFeaturesStub).to.have.been.calledOnce;
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Invalid submission');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const validateSubmissionFeaturesStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatures')
        .resolves(true);

      const submissionId = 1;

      const insertSubmissionRecordWithPotentialConflictStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({
          submission_id: submissionId,
          uuid: '123-456-789',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          contributor_id: 11,
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          record_end_date: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        });

      sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: 'some-uuid' });

      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'sub-upload-uuid' });

      const insertSubmissionFeatureRecordsStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionFeatureRecords')
        .resolves();

      const indexFeaturesBySubmissionIdStub = sinon
        .stub(SearchFeatureService.prototype, 'indexFeaturesBySubmissionId')
        .resolves();

      const findSubmissionFeaturesStub = sinon.stub(SubmissionService.prototype, 'findSubmissionFeatures').resolves([
        {
          submission_feature_id: 2,
          submission_id: submissionId,
          urn: `urn:${submissionId}:artifact:2`,
          feature_type_id: 3,
          uuid: '321-645-978',
          source_id: '4',
          data: {
            filename: 'test-file.txt'
          },
          parent_submission_feature_id: null,
          record_effective_date: '',
          record_end_date: null,
          create_date: '',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 1
        }
      ]);

      const calculateAndAddRegionsForSubmissionStub = sinon
        .stub(RegionService.prototype, 'calculateAndAddRegionsForSubmission')
        .resolves();

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const feature1 = {
        id: '2',
        type: 'dataset',
        properties: {
          name: 'dataset two'
        },
        child_features: []
      };

      mockReq.body = {
        id: '564-987-789',
        name: 'test submission',
        description: 'a test submission',
        comment: 'a comment',
        content: feature1
      };
      mockReq.keycloak_token = { clientId: 'sims-service-client' };
      mockReq.system_user = { system_user_id: 3 };
      mockReq.contributor_id = 11;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(validateSubmissionFeaturesStub).to.have.been.calledOnceWith([feature1]);
      expect(insertSubmissionRecordWithPotentialConflictStub).to.have.been.calledOnceWith(
        '564-987-789',
        'test submission',
        'a test submission',
        'a comment',
        3,
        11
      );
      expect(insertSubmissionFeatureRecordsStub).to.have.been.calledOnceWith(submissionId, 'sub-upload-uuid', [
        feature1
      ]);
      expect(indexFeaturesBySubmissionIdStub).to.have.been.calledOnceWith(submissionId);
      expect(findSubmissionFeaturesStub).to.have.been.calledOnceWith({
        submissionId: submissionId,
        featureTypeNames: ['artifact', 'file', 'report']
      });

      expect(calculateAndAddRegionsForSubmissionStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({
        submission_id: submissionId,
        submission_uuid: '123-456-789',
        artifact_upload_keys: [
          {
            artifact_filename: 'test-file.txt',
            artifact_upload_key: '321-645-978'
          }
        ]
      });
    });
  });
});
