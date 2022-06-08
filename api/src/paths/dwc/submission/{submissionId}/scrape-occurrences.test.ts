import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { ApiGeneralError } from '../../../../errors/api-error';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as scrapeOccurrences from './scrape-occurrences';
import { POST } from './scrape-occurrences';

chai.use(sinonChai);

describe('scrape-occurrences', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      const basicRequest = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {}
      };

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const request = { ...basicRequest, params: { submissionId: null } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has negative value', async () => {
          const request = { ...basicRequest, params: { submissionId: -1 } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be >= 1');
        });

        it('has string value', async () => {
          const request = { ...basicRequest, params: { submissionId: 'string' } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has invalid key', async () => {
          const request = { ...basicRequest, params: { id: 1 } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal("must have required property 'submissionId'");
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const request = { ...basicRequest, params: { submissionId: 1 } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be array');
        });

        it('has array with invalid key value', async () => {
          const apiResponse = [{ id: 1 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal("must have required property 'occurrence_id'");
        });

        it('has array with invalid value', async () => {
          const apiResponse = [{ occurrence_id: 'test' }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be integer');
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const apiResponse = [{ occurrence_id: 1 }, { occurrence_id: 2 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('scrapeAndUploadOccurrences', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('scrapes subbmission file and uploads occurrences and returns 200 and occurrence ids on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurrences')
        .resolves([{ occurrence_id: 1 }, { occurrence_id: 2 }]);

      const requestHandler = scrapeOccurrences.scrapeAndUploadOccurrences();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([{ occurrence_id: 1 }, { occurrence_id: 2 }]);
    });

    it('should throw an error if scrapeAndUploadOccurrences throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurrences')
        .throws('error' as unknown as ApiGeneralError);

      try {
        const requestHandler = scrapeOccurrences.scrapeAndUploadOccurrences();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });
  });
});
