import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinonChai from 'sinon-chai';
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
      });
    });
  });
});
