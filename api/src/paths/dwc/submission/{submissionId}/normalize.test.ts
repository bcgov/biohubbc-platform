import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { ApiGeneralError } from '../../../../errors/api-error';
import { DarwinCoreService } from '../../../../services/dwc-service';
import * as keycloakUtils from '../../../../utils/keycloak-utils';
import { DWCArchive } from '../../../../utils/media/dwc/dwc-archive-file';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as normalize from './normalize';
import { POST } from './normalize';

chai.use(sinonChai);

describe('normalize', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const { mockReq } = getRequestHandlerMocks();

          mockReq.params = { submissionId: null as unknown as string };
          mockReq.headers = {
            'content-type': 'application/json'
          };

          const response = requestValidator.validateRequest(mockReq);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has negative value', async () => {
          const { mockReq } = getRequestHandlerMocks();

          mockReq.params = { submissionId: -1 as unknown as string };
          mockReq.headers = {
            'content-type': 'application/json'
          };

          const response = requestValidator.validateRequest(mockReq);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be >= 1');
        });

        it('has string value', async () => {
          const { mockReq } = getRequestHandlerMocks();

          mockReq.params = { submissionId: 'string' as unknown as string };
          mockReq.headers = {
            'content-type': 'application/json'
          };

          const response = requestValidator.validateRequest(mockReq);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has invalid key', async () => {
          const { mockReq } = getRequestHandlerMocks();

          mockReq.params = { id: 1 as unknown as string };
          mockReq.headers = {
            'content-type': 'application/json'
          };

          const response = requestValidator.validateRequest(mockReq);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal("must have required property 'submissionId'");
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const { mockReq } = getRequestHandlerMocks();

          mockReq.params = { submissionId: 1 as unknown as string };
          mockReq.headers = {
            'content-type': 'application/json'
          };

          const response = requestValidator.validateRequest(mockReq);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('normalizeSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if source system validation fails', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      const requestHandler = normalize.normalizeSubmission();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('Failed to identify known submission source system');
      }
    });

    it('should throw an error if scrapeAndUploadOccurrences throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves('valid' as unknown as DWCArchive);

      sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').throws('error' as unknown as ApiGeneralError);

      try {
        const requestHandler = normalize.normalizeSubmission();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });

    it('normalizes submission file and uploads jsonblob and returns 200 and submission_id on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves('valid' as unknown as DWCArchive);

      sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const requestHandler = normalize.normalizeSubmission();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(undefined);
    });
  });
});
