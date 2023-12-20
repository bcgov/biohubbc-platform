import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { SearchIndexService } from '../../services/search-index-service';
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

    it('throws a 400 error when source system keycloak is not in req', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').returns(null);

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        id: 'aaaa',
        type: 'submission',
        properties: {},
        features: []
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Failed to identify known submission source system');
      }
    });

    it('throws error if validationService returns false', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const validateSubmissionFeaturesStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatures')
        .resolves(false);

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        id: 'aaaa',
        type: 'submission',
        properties: {},
        features: []
      };

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
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const validateSubmissionFeaturesStub = sinon
        .stub(ValidationService.prototype, 'validateSubmissionFeatures')
        .resolves(true);

      const insertSubmissionRecordWithPotentialConflictStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecordWithPotentialConflict')
        .resolves({ submission_id: 1 });

      const insertSubmissionFeatureRecordsStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionFeatureRecords')
        .resolves();

      const indexFeaturesBySubmissionIdStub = sinon
        .stub(SearchIndexService.prototype, 'indexFeaturesBySubmissionId')
        .resolves();

      const requestHandler = intake.submissionIntake();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        id: 'aaaa',
        type: 'submission',
        properties: { additionalInformation: 'test' },
        features: []
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(validateSubmissionFeaturesStub).to.have.been.calledOnce;
      expect(insertSubmissionRecordWithPotentialConflictStub).to.have.been.calledOnce;
      expect(insertSubmissionFeatureRecordsStub).to.have.been.calledOnce;
      expect(indexFeaturesBySubmissionIdStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql({ submission_id: 1 });
    });
  });
});
