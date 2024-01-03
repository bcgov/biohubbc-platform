import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { HTTPError } from '../../../../errors/http-error';
import { SecurityService } from '../../../../services/security-service';
import { RelatedDataset, SubmissionService } from '../../../../services/submission-service';
import { UserService } from '../../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { GET, getRelatedDatasetsByDatasetId } from './related';

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
        url: 'https://example.com/374c4d6a-3a04-405b-af6d-b6497800a691',
        supplementaryData: {
          isPendingReview: false
        }
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

  it('should return a valid array of related datasets on success', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const submissionServiceStub = sinon
      .stub(SubmissionService.prototype, 'findRelatedDatasetsByDatasetId')
      .resolves([{ datasetId: '123' }, { datasetId: '456' }] as RelatedDataset[]);

    const isSystemUserAdminStub = sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);

    const securityStub = sinon.stub(SecurityService.prototype, 'isDatasetPendingReview');
    securityStub.onFirstCall().resolves(true);
    securityStub.onSecondCall().resolves(false);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    const requestHandler = getRelatedDatasetsByDatasetId();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(submissionServiceStub).to.be.calledWith('abcd');
    expect(mockRes.jsonValue).to.eql({
      datasetsWithSupplementaryData: [
        {
          datasetId: '123',
          supplementaryData: {
            isPendingReview: true
          }
        },
        {
          datasetId: '456',
          supplementaryData: {
            isPendingReview: false
          }
        }
      ]
    });
    expect(isSystemUserAdminStub).to.be.calledOnce;
  });

  it('catches and re-throws an error', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
    sinon.stub(UserService.prototype, 'isSystemUserAdmin').resolves(true);

    sinon.stub(SubmissionService.prototype, 'findRelatedDatasetsByDatasetId').rejects(new Error('a test error'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      datasetId: 'abcd'
    };

    try {
      const requestHandler = getRelatedDatasetsByDatasetId();

      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('a test error');
    }
  });
});
