import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { SpatialService } from '../../../services/spatial-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as metadata from './metadata';
import { GET } from './metadata';

chai.use(sinonChai);

describe('metadata', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('submissionSpatialComponentId', () => {
          it('is undefined', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              params: {}
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('submissionSpatialComponentId');
            expect(response.errors[0].message).to.equal("must have required property 'submissionSpatialComponentId'");
          });

          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              params: {
                submissionSpatialComponentId: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('submissionSpatialComponentId');
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('is zero', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              params: {
                submissionSpatialComponentId: 0
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('submissionSpatialComponentId');
            expect(response.errors[0].message).to.equal('must be >= 1');
          });
        });
      });

      describe('should succeed when', () => {
        it('all values are provided and valid', async () => {
          const request = {
            headers: {
              'content-type': 'application/json'
            },
            params: {
              submissionSpatialComponentId: 1
            }
          };
          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('response');
          expect(response.errors[0].message).to.equal('must be object');
        });

        it('returns invalid response (not an object)', async () => {
          // array of `Feature` rather than `FeatureCollection`
          const apiResponse = 'not an object';

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('response');
          expect(response.errors[0].message).to.equal('must be object');
        });
      });

      describe('should succeed when', () => {
        it('required values are valid (empty)', async () => {
          const apiResponse = {};

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('required values are valid', async () => {
          const apiResponse = { prop1: 'val1' };

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('getSpatialMetadataByIds', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { submissionSpatialComponentIds: ['1'] };

      sinon
        .stub(SpatialService.prototype, 'findSpatialMetadataBySubmissionSpatialComponentId')
        .throws(new Error('test error'));

      const requestHandler = metadata.getSpatialMetadataByIds();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
      }
    });

    it('returns 200', async () => {
      const dbConnectionObj = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = { submissionSpatialComponentIds: ['1'] };

      const mockResponse = { prop1: 'val1' };

      sinon.stub(SpatialService.prototype, 'findSpatialMetadataBySubmissionSpatialComponentId').resolves(mockResponse);

      const requestHandler = metadata.getSpatialMetadataByIds();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockResponse);
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    });
  });
});
