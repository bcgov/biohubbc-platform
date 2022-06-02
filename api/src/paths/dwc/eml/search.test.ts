import { Client } from '@elastic/elasticsearch';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ESService } from '../../../services/es-service';
import { getRequestHandlerMocks } from '../../../__mocks__/db';
import * as search from './search';
import { GET } from './search';

chai.use(sinonChai);

describe('search', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator((GET.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

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
      const responseValidator = new OpenAPIResponseValidator((GET.apiDoc as unknown) as OpenAPIResponseValidatorArgs);

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

        it('has array with invalid key value: source', async () => {
          const apiResponse = [{ id: 'test', source1: 1 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal("must have required property 'source'");
        });

        it('has array with invalid key value: fields', async () => {
          const apiResponse = [{ id: 'test', source: {}, fields1: {} }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal("must have required property 'fields'");
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

    describe('search terms in Elastic Search', () => {
      afterEach(() => {
        sinon.restore();
      });
      it('throws an error when getting the Elastic Search service fails', async () => {
        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

        mockReq.body = {
          terms: 'test'
        };

        sinon.stub(ESService.prototype, 'getEsClient').resolves(undefined);

        const requestHandler = search.searchInElasticSearch();

        try {
          await requestHandler(mockReq, mockRes, mockNext);
          expect.fail();
        } catch (actualError) {
          expect((actualError as Error).message).to.equal("Cannot read property 'search' of undefined");
        }
      });

      it('returns search results when Elastic Search service succeeds with valid data', async () => {
        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

        mockReq.query = {
          index: 'EML',
          terms: 'searchterm'
        };

        const searchStub = sinon.stub().resolves({
          hits: {
            hits: [{ _id: 'testid', _source: {}, fields: {} }]
          }
        });

        sinon.stub(ESService.prototype, 'getEsClient').resolves(({
          search: searchStub
        } as unknown) as Client);

        const requestHandler = search.searchInElasticSearch();

        await requestHandler(mockReq, mockRes, mockNext);
        expect(mockRes.jsonValue).eql([{ id: 'testid', source: {}, fields: {} }]);
        expect(searchStub).to.have.been.calledOnceWith({
          index: 'eml',
          query: {
            match: {
              'projects.projectName': 'searchterm'
            }
          },
          fields: ['*']
        });
      });
    });
  });
});
