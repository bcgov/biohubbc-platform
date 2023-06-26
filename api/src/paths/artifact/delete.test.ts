import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { getMockDBConnection } from '../../__mocks__/db';
import { POST } from './delete';

chai.use(sinonChai);

describe.only('delete artifact', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);
      it('should have property `artifactUUIDs`', async () => {
        const request = {
          headers: { 'content-type': 'application/json' },
          body: {}
        };
        const response = requestValidator.validateRequest(request);
        expect(response.status).to.equal(400);
        expect(response.errors.length).to.equal(1);
        expect(response.errors[0].message).to.equal("must have required property 'artifactUUIDs'");
      });

      it('should be an array error', async () => {
        const request = {
          headers: { 'content-type': 'application/json' },
          body: {
            artifactUUIDs: ''
          }
        };
        const response = requestValidator.validateRequest(request);
        expect(response.status).to.equal(400);
        expect(response.errors.length).to.equal(1);
        expect(response.errors[0].message).to.equal('must be array');
      });

      it('should match format "uuid" error', async () => {
        const request = {
          headers: { 'content-type': 'application/json' },
          body: {
            artifactUUIDs: ['uuid']
          }
        };
        const response = requestValidator.validateRequest(request);
        expect(response.status).to.equal(400);
        expect(response.errors.length).to.equal(1);
        expect(response.errors[0].message).to.equal('must match format "uuid"');
      });
    });

    describe.only('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      describe('should throw an error', () => {});
    });
  });
  // let actualResult: any = null;

  // const sampleRes = {
  //   status: () => {
  //     return {
  //       json: (result: any) => {
  //         actualResult = result;
  //       }
  //     };
  //   }
  // };

  describe('deleteArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a success object', async () => {});
    it('should catch and re throw an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      // const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      // sinon.stub(keycloackUtils, 'getKeycloakSource').resolves(true);
      // const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      // mockReq.body = {
      //   artifactUUIDs: ['UUID-TO-DELETE']
      // };
    });
  });
});
