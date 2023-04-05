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
import { GET, getRelatedDatasetsByDatasetId } from './related';
import { SubmissionService } from '../../../../services/submission-service';

chai.use(sinonChai);

describe('getRelatedDatasetsByDatasetId', () => {
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

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      const mockRelatedDataset = {
        datasetId: '374c4d6a-3a04-405b-af6d-b6497800a691',
        title: 'Test-Related-Dataset',
        url: 'https://example.com/374c4d6a-3a04-405b-af6d-b6497800a691'
      };

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be object');
        });

        it('returns a null array', async () => {
          const apiResponse = { datasets: null };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be array');
        });

        describe('dataset', () => {
          it('returns a null response', async () => {
            const apiResponse = { datasets: [null] };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be object');
          });

          describe('datsetId', () => {
            it('is undefined', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    datasetId: undefined
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'datasetId'");
            });

            it('is null', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    datasetId: null
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is wrong type', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    datasetId: 1
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });
          });

          describe('title', () => {
            it('is undefined', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    title: undefined
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'title'");
            });

            it('is null', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    title: null
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is wrong type', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    title: 1
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });
          });

          describe('url', () => {
            it('is undefined', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    url: undefined
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'url'");
            });

            it('is null', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    url: null
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is wrong type', async () => {
              const apiResponse = {
                datasets: [
                  {
                    ...mockRelatedDataset,
                    url: 1
                  }
                ]
              };
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = {
            datasets: [mockRelatedDataset]
          };

          const response = responseValidator.validateResponse(200, apiResponse);
          expect(response).to.equal(undefined);
        });

        it('returns an empty array of related datasets', async () => {
          const apiResponse = {
            datasets: []
          };

          const response = responseValidator.validateResponse(200, apiResponse);
          expect(response).to.equal(undefined);
        });
      });
      
    });
  });

  it('should return an empty array if no related projects could be found', async () => {
    // @TODO
  });

  it('should return an empty array if JSON Path fails to return any results', async () => {
    // @TODO
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
