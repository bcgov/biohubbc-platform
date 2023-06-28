import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { ArtifactService } from '../../services/artifact-service';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import { deleteArtifact, POST } from './delete';

chai.use(sinonChai);

describe('delete artifact', () => {
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

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      describe('should throw an error', () => {
        it('has null value', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be boolean');
        });

        it('returning wrong response', async () => {
          const apiResponse = { wrong_property: 1 };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be boolean');
        });
      });

      describe('responders properly', () => {
        it('has valid values', async () => {
          const apiResponse = true;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('deleteArtifact', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and throws error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(false);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').throws('There was an issue deleting an artifact.');
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = deleteArtifact();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error: any) {
        expect(error.name).to.be.eql('There was an issue deleting an artifact.');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('responds with proper data', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(false);
      sinon.stub(ArtifactService.prototype, 'deleteArtifacts').resolves();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.body = {
        artifactUUIDs: ['ff84ecfc-046e-4cac-af59-a597047ce63d']
      };
      const requestHandler = deleteArtifact();

      await requestHandler(mockReq, mockRes, mockNext);
      expect(dbConnectionObj.release).to.have.been.calledOnce;
      expect(dbConnectionObj.rollback).to.have.not.been.calledOnce;
    });
  });
});
