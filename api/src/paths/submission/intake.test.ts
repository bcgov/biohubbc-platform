import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { SystemUser } from '../../repositories/user-repository';
import { RegionService } from '../../services/region-service';
import { SubmissionProcessService } from '../../services/submission-process-service';
import { SubmissionService } from '../../services/submission-service';
import { ValidationService } from '../../services/validation-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
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
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

      const validateSubmissionFeaturesStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatureShape')
        .rejects(new Error('a test error'));

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        id: '123-456-789',
        type: 'submission',
        properties: {},
        child_features: []
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect(validateSubmissionFeaturesStub).to.have.been.calledOnce;
        expect((error as HTTPError).message).to.equal('a test error');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 1 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const serviceClientSystemUser: SystemUser = {
        system_user_id: 3,
        user_identifier: 'sims',
        user_guid: 'service-account-sims',
        user_identity_source_id: 5,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_user: 1,
        create_date: '2024-01-01',
        update_user: null,
        update_date: null,
        revision_count: 0
      };

      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(serviceClientSystemUser);

      const validateSubmissionFeatureStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatureShape')
        .resolves();

      const submissionId = 1;

      const insertSubmissionRecordWithPotentialConflictStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({
          submission_id: submissionId,
          uuid: '123-456-789',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        });

      const processSubmissionFeaturesStub = sinon
        .stub(SubmissionProcessService.prototype, '_processSubmissionFeatures')
        .resolves();

      const findSubmissionFeaturesStub = sinon.stub(SubmissionService.prototype, 'findSubmissionFeatures').resolves([
        {
          submission_feature_id: 2,
          submission_id: submissionId,
          feature_type_id: 3,
          uuid: '321-645-978',
          source_id: '4',
          data: { filename: 'test-file.txt' },
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
        properties: { name: 'dataset two' },
        child_features: []
      };

      mockReq.body = {
        id: 'uuid-1',
        name: 'test submission',
        description: 'a test submission',
        comment: 'a comment',
        content: feature1
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(insertSubmissionRecordWithPotentialConflictStub).to.have.been.calledOnceWith({
        quarantine_id: null,
        uuid: 'uuid-1',
        name: 'test submission',
        comment: 'a comment',
        description: 'a test submission',
        system_user_id: 1,
        source_system: 'SIMS'
      });

      expect(processSubmissionFeaturesStub).to.have.been.calledOnceWith(submissionId, [feature1]);
      expect(findSubmissionFeaturesStub).to.have.been.calledOnceWith({
        submissionId,
        featureTypeNames: ['artifact']
      });

      expect(calculateAndAddRegionsForSubmissionStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({
        submission_uuid: '123-456-789',
        artifact_upload_keys: [
          {
            artifact_filename: 'test-file.txt',
            artifact_upload_key: '321-645-978'
          }
        ]
      });

      expect(validateSubmissionFeatureStub).to.have.been.calledOnceWith(feature1);
    });
  });
});
