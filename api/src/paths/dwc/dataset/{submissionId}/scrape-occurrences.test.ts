import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTPError } from '../../../../errors/http-error';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import chaiResponseValidator from 'chai-openapi-response-validator';
import * as db from '../../../../database/db';
import * as scrapeOccurrences from './scrape-occurrences';
import { ApiGeneralError } from '../../../../errors/api-error';
import axios from 'axios';

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

      const response = await axios.get('paths/dwc/dataset/1/scrape-occurrences');
      const openApiSpec = response.data;
      chai.use(chaiResponseValidator(openApiSpec));

      try {
        const res = await axios.get('http://localhost:6100/paths/dwc/dataset/null/scrape-occurrences');

        console.log('res:', res);

        expect.fail();
      } catch (actualError) {
        console.log('actualError:', actualError);
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
        console.log('actualError:', actualError);

        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });
  });
});
