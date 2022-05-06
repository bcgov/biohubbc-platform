import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import * as scrapeOccurrences from './scrape-occurrences';
import { ApiGeneralError } from '../../../../errors/api-error';
import { OpenApiValidator } from 'openapi-data-validator';
import { POST } from './scrape-occurrences';
import { rootAPIDoc } from '../../../../openapi/root-api-doc';
import { OpenAPIV3 } from 'openapi-data-validator/dist/framework/types';

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

    it('should throw an error on OpenApiSchema', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const newPath = {
        '/dwc/dataset/{submissionId}/scrape-occurrences': {
          post: POST.apiDoc
        }
      };
      console.log('newPath', newPath);

      const newRootApiDoc: OpenAPIV3.Document = ({ ...rootAPIDoc, paths: newPath } as unknown) as OpenAPIV3.Document;

      console.log('newRootApiDoc', newRootApiDoc);

      const openApiValidator = new OpenApiValidator({ apiSpec: newRootApiDoc });

      console.log('openApiValidator', openApiValidator);

      const validator = await openApiValidator.createValidator();

      console.log('validator', validator);

      try {
        const newRequest = {
          method: 'POST',
          route: '/dwc/dataset/{submissionId}/scrape-occurrences',
          // headers: { Authorization: 'Bearer Token' },
          // query: { limit: 10 },
          // body: { field: true },

          path: {}
        };
        await validator(newRequest);

        expect.fail();
      } catch (error) {
        expect((error as any).status).to.equal(400);
        expect((error as any).errors[0].message).to.equal("must have required property 'submissionId'");
      }
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
