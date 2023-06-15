import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as apply from './apply';
import { POST } from './apply';

chai.use(sinonChai);

describe('apply', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('artifactIds', () => {
          it('is undefined', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: undefined,
                securityReasonIds: [1, 2, 3, 4]
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'artifactIds'");
          });

          it('is null', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: null,
                securityReasonIds: [1, 2, 3, 4]
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be array');
          });
          it('is an empty array', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: [],
                securityReasonIds: [1, 2, 3, 4]
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response).to.equal(undefined);
          });
          it('are strings', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: ['a', 'b'],
                securityReasonIds: [1, 2, 3, 4]
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(2);
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });

        describe('securityReasonIds', () => {
          it('is undefined', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: [1, 2, 3, 4],
                securityReasonIds: undefined
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'securityReasonIds'");
          });

          it('is null', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: [1, 2, 3, 4],
                securityReasonIds: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be array');
          });
          it('is an empty array', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: [1, 2, 3, 4],
                securityReasonIds: []
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response).to.equal(undefined);
          });
          it('are strings', async () => {
            const request = {
              headers: { 'content-type': 'application/json' },
              body: {
                artifactIds: [1, 2, 3, 4],
                securityReasonIds: ['a', 'b']
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(2);
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const request = {
            headers: { 'content-type': 'application/json' },
            body: {
              artifactIds: [1, 2, 3, 4],
              securityReasonIds: [5, 6, 7, 8]
            }
          };

          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be array');
        });

        it('returns an empty response', async () => {
          const apiResponse = {};
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be array');
        });

        describe('artifact_persecution_id', () => {
          it('is null', async () => {
            const apiResponse = [{ artifact_persecution_id: null }];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('is wrong type', async () => {
            const apiResponse = [{ artifact_persecution_id: 'a' }];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = [{ artifact_persecution_id: 1 }];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('applySecurityRulesToArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return the rows on success (empty)', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const applySecurityRulesToArtifactsStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifacts')
        .resolves([]);

      mockReq.body = {
        artifactIds: [1, 2, 3, 4],
        securityReasonIds: [1, 2, 3, 4]
      };

      const requestHandler = apply.applySecurityRulesToArtifacts();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(applySecurityRulesToArtifactsStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([]);
    });

    it('should return the rows on success (not empty)', async () => {
      const data = {
        artifact_persecution_id: 1
      };

      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.body = {
        artifactIds: [1, 2, 3, 4],
        securityReasonIds: [1, 2, 3, 4]
      };

      const applySecurityRulesToArtifactsStub = sinon
        .stub(SecurityService.prototype, 'applySecurityRulesToArtifacts')
        .resolves([data]);

      const requestHandler = apply.applySecurityRulesToArtifacts();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(applySecurityRulesToArtifactsStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([data]);
    });
  });
});
