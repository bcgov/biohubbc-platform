import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { Artifact } from '../../../repositories/artifact-repository';
import { ArtifactService } from '../../../services/artifact-service';
import { UserService } from '../../../services/user-service';
import * as file_utils from '../../../utils/file-utils';
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

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: null,
        key: 'sample-key'
      } as Artifact);

      const systemAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
      const getS3SignedURLStub = sinon.stub(file_utils, 'getS3SignedURL').resolves('http://example.com');

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

      expect(actualResult).to.eql('http://example.com');
      expect(getArtifactStub).to.be.calledWith(200);
      expect(systemAdminStub).to.be.calledOnce;
      expect(getS3SignedURLStub).to.be.calledWith('sample-key');
    });

    it('should return a URL for a non-pending artifact to administrators', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: new Date(),
        key: 'sample-key'
      } as Artifact);

      const systemAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
      const getS3SignedURLStub = sinon.stub(file_utils, 'getS3SignedURL').resolves('http://example.com');

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

      expect(actualResult).to.eql('http://example.com');
      expect(getArtifactStub).to.be.calledWith(200);
      expect(systemAdminStub).to.be.calledOnce;
      expect(getS3SignedURLStub).to.be.calledWith('sample-key');
    });

    it('should not return a URL for a pending artifact to non-administrators', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: null,
        key: 'sample-key'
      } as Artifact);

      const systemAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(false);

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
        expect((actualError as HTTPError).message).to.equal(
          'Documents that are pending review can only be downloaded by administrators.'
        );
        expect(getArtifactStub).to.be.calledWith(200);
        expect(systemAdminStub).to.be.calledOnce;
      }
    });

    it('should catch and rethrow errors', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifactById').resolves({
        security_review_timestamp: new Date(),
        key: 'sample-key'
      } as Artifact);

      const systemAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);
      const getS3SignedURLStub = sinon
        .stub(file_utils, 'getS3SignedURL')
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
        expect(getArtifactStub).to.be.calledWith(200);
        expect(systemAdminStub).to.be.calledOnce;
        expect(getS3SignedURLStub).to.be.calledOnce;
      }
    });
  });
});
