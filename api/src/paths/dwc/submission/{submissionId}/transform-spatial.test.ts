import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { SpatialService } from '../../../../services/spatial-service';
import * as keycloakUtils from '../../../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as transformSpatial from './transform-spatial';
import { POST } from './transform-spatial';

chai.use(sinonChai);

describe('transform-spatial', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      const basicRequest = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {},
        query: {}
      };

      describe('should throw an error when', () => {
        describe('required properties is missing', () => {
          it('property submissionId', async () => {
            const request = { ...basicRequest, params: {} };
            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal("must have required property 'submissionId'");
          });

          it('property transformId', async () => {
            const request = { ...basicRequest, params: { submissionId: 1 } };
            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal("must have required property 'transformId'");
          });
        });

        describe('required properties is invalid type', () => {
          describe('submissionId', () => {
            it('has null value', async () => {
              const request = { ...basicRequest, params: { submissionId: null }, query: { transformId: 1 } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('has negative value', async () => {
              const request = { ...basicRequest, params: { submissionId: -1 }, query: { transformId: 1 } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be >= 1');
            });

            it('has string value', async () => {
              const request = { ...basicRequest, params: { submissionId: 'string' }, query: { transformId: 1 } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });
          describe('transformId', () => {
            it('has null value', async () => {
              const request = { ...basicRequest, params: { submissionId: 1 }, query: { transformId: null } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('has negative value', async () => {
              const request = { ...basicRequest, params: { submissionId: 1 }, query: { transformId: -1 } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be >= 1');
            });

            it('has string value', async () => {
              const request = { ...basicRequest, params: { submissionId: 1 }, query: { transformId: 'string' } };
              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const request = { ...basicRequest, params: { submissionId: 1 }, query: { transformId: 1 } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should succeed when', () => {
        it('has null values', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('transformSpatialSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error when getKeycloakSource returns null', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };
      mockReq.query = { transformId: '1' };

      sinon.stub(keycloakUtils, 'getKeycloakSource').returns(null);

      const requestHandler = transformSpatial.transformSpatialSubmission();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('Failed to identify known submission source system');
      }
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };
      mockReq.query = { transformId: '1' };

      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      sinon.stub(SpatialService.prototype, 'getSpatialTransformBySpatialTransformId').throws(new Error('test error'));

      const requestHandler = transformSpatial.transformSpatialSubmission();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('returns 200', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };
      mockReq.query = { transformId: '1' };

      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const getSpatialTransformBySpatialTransformIdStub = sinon
        .stub(SpatialService.prototype, 'getSpatialTransformBySpatialTransformId')
        .resolves({ transform: 'string' });

      const runSpatialTransformStub = sinon.stub(SpatialService.prototype, 'runSpatialTransform').resolves();

      const requestHandler = transformSpatial.transformSpatialSubmission();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSpatialTransformBySpatialTransformIdStub).to.have.been.calledOnceWith(1);
      expect(runSpatialTransformStub).to.have.been.calledOnceWith(1, 'string');
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(undefined);
    });
  });
});
