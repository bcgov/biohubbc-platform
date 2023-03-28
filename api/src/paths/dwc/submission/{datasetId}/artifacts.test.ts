import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { Artifact } from '../../../../repositories/artifact-repository';
import { ArtifactService } from '../../../../services/artifact-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { GET, getArtifactsByDatasetId } from './artifacts';

chai.use(sinonChai);

describe.only('getArtifactsByDatasetId', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('datasetId', () => {
          it('is invalid type', async () => {
            const request = {
              params: { datasetId: 123 }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('is invalid format', async () => {
            const request = {
              params: { datasetId: 'abcdefg' }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must match format "uuid"');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const request = {
            params: { datasetId: '374c4d6a-3a04-405b-af6d-b6497800a691' }
          };

          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });
      });
    });

    describe.skip('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      const mockResponse = {
        artifact_id: 1,
        description: "aaa",
        file_name: "Lecture 5 - Partial Fraction.pdf",
        file_size: 2405262,
        file_type: "Report",
        foi_reason_description: null,
        key: "cupshall/platform/datasets/de621765-9fd0-4216-91b7-ec455d9c3eb1/artifacts/1/374c4d6a-3a04-405b-af6d-b6497800a691.zip",
        security_review_timestamp: null,
        submission_id: 1,
        title: "Report 2",
        uuid: "374c4d6a-3a04-405b-af6d-b6497800a691",
      }

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be array');
        });

        describe('artifact', () => {
          it('returns a null response', async () => {
            const apiResponse = [null];
            const response = responseValidator.validateResponse(200, apiResponse);
  
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be object');
          });
  
          describe('artifact_id', () => {
            it('is undefined', async () => {
              const apiResponse = {
                ...mockResponse,
                artifact_id: undefined
              };
              const response = responseValidator.validateResponse(200, apiResponse);
  
              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'artifact_id'");
            });
  
            it('is null', async () => {
              const apiResponse = {
                ...mockResponse,
                artifact_id: null
              };
              const response = responseValidator.validateResponse(200, apiResponse);
  
              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });
  
            it('is wrong type', async () => {
              const apiResponse = {
                ...mockResponse,
                artifact_id: '1'
              };
              const response = responseValidator.validateResponse(200, apiResponse);
  
              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = {
            artifact_id: 1,
            description: "Test description",
            file_name: "Filename.docx",
            file_size: 1024,
            file_type: "Report",
            foi_reason_description: null,
            key: "platform/datasets/de621765-9fd0-4216-91b7-ec455d9c3eb1/artifacts/1/374c4d6a-3a04-405b-af6d-b6497800a691.zip",
            security_review_timestamp: null,
            submission_id: 1,
            title: "Test Report",
            uuid: "374c4d6a-3a04-405b-af6d-b6497800a691",
          };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  it('should return a valid array of artifact records on success', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const artifactServiceStub = sinon
      .stub(ArtifactService.prototype, 'getArtifactsByDatasetId')
      .resolves([{ artifact_id: 1 }, { artifact_id: 2 }] as Artifact[]);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    const requestHandler = getArtifactsByDatasetId();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(artifactServiceStub).to.be.calledWith('abcd');
    expect(mockRes.jsonValue).to.eql({
      artifacts: [{ artifact_id: 1 }, { artifact_id: 2 }]
    });
  });

  it('catches and re-throws an error', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(ArtifactService.prototype, 'getArtifactsByDatasetId').rejects(new Error('a test error'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    try {
      const requestHandler = getArtifactsByDatasetId();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('a test error');
    }
  });
});
