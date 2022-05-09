import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import * as scrapeOccurrences from './scrape-occurrences';
import { ApiGeneralError } from '../../../../errors/api-error';
import { POST } from './scrape-occurrences';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
// import { rootAPIDoc } from '../../../../openapi/root-api-doc';

chai.use(sinonChai);

describe.only('scrape-occurrences', () => {
  describe('scrapeAndUploadOccurrences', () => {
    afterEach(() => {
      sinon.restore();
    });

    const sampleReq = {
      keycloak_token: {},
      params: {
        submissionId: 1
      }
    } as any;

    const sampleRes = [{ occurrence_id: 1 }, { occurrence_id: 2 }];

    it('should throw an error on OpenApiSchema validation', async () => {
      const requestValidator = new OpenAPIRequestValidator((POST.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

      const request = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {
          submissionId: null
        }
      };

      const response = requestValidator.validateRequest(request);

      expect(response.status).to.equal(400);
      expect(response.errors[0].message).to.equal('must be number');
    });

    it('should succeed on OpenApiSchema validation', async () => {
      const requestValidator = new OpenAPIRequestValidator((POST.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

      const request = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {
          submissionId: 1
        }
      };

      const response = requestValidator.validateRequest(request);

      expect(response).to.equal(undefined);
    });

    it('scrapes subbmission file and uploads occurrences and returns 200 and occurrence ids on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = sampleReq.params;

      sinon.stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurences').resolves(sampleRes);

      const requestHandler = scrapeOccurrences.scrapeAndUploadOccurrences();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.equal(sampleRes);
    });

    it('should throw an error if scrapeAndUploadOccurrences throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = sampleReq.params;

      sinon
        .stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurences')
        .throws(('error' as unknown) as ApiGeneralError);

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
