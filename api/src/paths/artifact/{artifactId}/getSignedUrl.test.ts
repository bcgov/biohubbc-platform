import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection } from '../../../__mocks__/db';
import * as getSignedUrl from './getSignedUrl';
import { GET } from './getSignedUrl';

chai.use(sinonChai);

describe('getSignedUrl', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('artifactId', () => {
          it('is missing', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'artifactId'");
          });

          it('is invalid type', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              params: {
                artifactId: '1'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const request = {
            headers: { 'content-type': 'multipart/form-data' },
            params: {
              artifactId: 1
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
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be string');
        });

        it('returns wrong format', async () => {
          const apiResponse = { key: 'value' };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be string');
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = 'http://example.com';
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('getArtifactSignedUrl', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return the signed URL successfully', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSignedURLStub = sinon
        .stub(SecurityService.prototype, 'getSecuredArtifactBasedOnRulesAndPermissions')
        .resolves('sample-signedURL');

      let actualResult: any = null;

      const sampleReq = {
        params: {
          artifactId: 200
        }
      } as any;

      const sampleRes = {
        status: () => {
          return {
            send: (result: any) => {
              actualResult = result;
            }
          };
        }
      };

      const result = getSignedUrl.getArtifactSignedUrl();

      await result(sampleReq, sampleRes as any, null as unknown as any);

      expect(actualResult).to.eql('sample-signedURL');
      expect(getSignedURLStub).to.be.calledWith(200);
    });

    it('should catch and rethrow errors', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getS3SignedURLStub = sinon
        .stub(SecurityService.prototype, 'getSecuredArtifactBasedOnRulesAndPermissions')
        .throws(new Error('test failed to get signed URL'));

      const sampleReq = {
        params: {
          artifactId: 200
        }
      } as any;

      try {
        const result = getSignedUrl.getArtifactSignedUrl();

        await result(sampleReq, null as unknown as any, null as unknown as any);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test failed to get signed URL');
        expect(getS3SignedURLStub).to.be.calledOnce;
      }
    });
  });
});
