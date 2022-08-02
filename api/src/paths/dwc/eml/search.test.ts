import { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { ESService } from '../../../services/es-service';
import { SubmissionService } from '../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as search from './search';
import { GET } from './search';

chai.use(sinonChai);

describe('search', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      const basicRequest = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {},
        query: {}
      };

      describe('should throw an error when', () => {
        it('has invalid type', async () => {
          const request = { ...basicRequest, query: { terms: false } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be string');
        });
      });

      describe('should succeed when', () => {
        it('has valid no value', async () => {
          const request = { ...basicRequest, query: { terms: '' } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });

        it('has valid single keyword value', async () => {
          const request = { ...basicRequest, query: { terms: 'test' } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });

        it('has valid single search value', async () => {
          const request = { ...basicRequest, query: { terms: 'test' } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be array');
        });

        it('has array with invalid key value: id', async () => {
          const apiResponse = [{ id1: 1 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal("must have required property 'id'");
        });

        it('has array with invalid value: id', async () => {
          const apiResponse = [{ id: 14, source: {}, fields: {} }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be string');
        });
        it('has array with invalid value: source', async () => {
          const apiResponse = [{ id: 'test', source: 1, fields: {} }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be object');
        });
        it('has array with invalid value: fields', async () => {
          const apiResponse = [{ id: 'test', source: {}, fields: 1 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be object');
        });
      });

      describe('should succeed when', () => {
        it('has empty valid values', async () => {
          const apiResponse: never[] = [];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('has valid values', async () => {
          const apiResponse = [
            { id: 'test1', source: {}, fields: {} },
            { id: 'test2', source: {}, fields: {} }
          ];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('searchInElasticSearch', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        terms: 'search-term'
      };

      sinon.stub(ESService.prototype, 'keywordSearchEml').throws(new Error('test error'));

      const requestHandler = search.searchInElasticSearch();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('returns search results when Elastic Search service succeeds with valid data', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {
        terms: 'search-term'
      };

      sinon
        .stub(SubmissionService.prototype, 'getSpatialComponentCountByDatasetId')
        .onCall(0)
        .resolves(14)
        .onCall(1)
        .resolves(23);

      const keywordSearchEmlStub = sinon.stub(ESService.prototype, 'keywordSearchEml').resolves([
        { _id: '123', _source: {}, fields: {} },
        { _id: '456', _source: {}, fields: {} }
      ] as unknown as SearchHit[]);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordJSONByDatasetId')
        .onCall(0)
        .resolves('a valid json string')
        .onCall(1)
        .resolves('another valid json string');

      const requestHandler = search.searchInElasticSearch();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(keywordSearchEmlStub).to.have.been.calledOnceWith('search-term');
      expect(mockRes.jsonValue).eql([
        { id: '123', source: 'a valid json string', observation_count: 14 },
        { id: '456', source: 'another valid json string', observation_count: 23 }
      ]);
    });
  });
});
