import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { ApiGeneralError } from '../../../errors/api-error';
import { SubmissionService } from '../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { GET, listDataset } from './list';

chai.use(sinonChai);

describe('submissions', () => {
  describe('openApiSchema', () => {
    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        describe('required return properties is missing', () => {
          it('property submission_id', async () => {
            const apiResponse = [{}];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'submission_id'");
          });

          it('property uuid', async () => {
            const apiResponse = [{ submission_id: 1, source: 'SIMS' }];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'uuid'");
          });

          it('property event_timestamp', async () => {
            const apiResponse = [{ submission_id: 1, source: 'SIMS', uuid: '2267501d-c6a9-43b5-b951-2324faff6397' }];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'event_timestamp'");
          });

          it('property create_date', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'create_date'");
          });

          it('property create_user', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'create_user'");
          });

          it('property revision_count', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'revision_count'");
          });
        });

        describe('return properties are invalid types', () => {
          it('null value', async () => {
            const apiResponse = null;
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not an object', async () => {
            const apiResponse = [''];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('property submission_id', async () => {
            const apiResponse = [
              {
                submission_id: '',
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15,
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('property source', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 1,
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15,
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('property uuid', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: 1,
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15,
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('property event_timestamp', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: 1,
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15,
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('property create_date', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: 1,
                create_user: 15,
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('property create_user', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: '',
                revision_count: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('property revision_count', async () => {
            const apiResponse = [
              {
                submission_id: 1,
                source: 'SIMS',
                uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
                event_timestamp: '2022-05-24T18:41:42.211Z',
                create_date: '2022-05-24T18:41:42.056Z',
                create_user: 15,
                revision_count: ''
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });
      });

      describe('should succeed when', () => {
        it('has valid empty value', async () => {
          const apiResponse: any[] = [];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('has valid values', async () => {
          const apiResponse = [
            {
              submission_id: 1,
              source: 'SIMS',
              uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
              event_timestamp: '2022-05-24T18:41:42.211Z',
              create_date: '2022-05-24T18:41:42.056Z',
              create_user: 15,
              revision_count: 1
            }
          ];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });
  describe('listSubmissions', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if listSubmissionRecords throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(SubmissionService.prototype, 'listSubmissionRecords').throws('error' as unknown as ApiGeneralError);

      try {
        const requestHandler = listDataset();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });

    it('should return rows on success', async () => {
      const mockDBConnection = getMockDBConnection();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse = [
        {
          submission_status: 'Submission Data Ingested',
          submission_id: 1,
          source_transform_id: 'SIMS',
          uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
          event_timestamp: '2022-05-24T18:41:42.211Z',
          delete_timestamp: null,
          input_key: 'platform/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
          eml_source: null,
          eml_json_source: null,
          darwin_core_source: 'test',
          create_date: '2022-05-24T18:41:42.056Z',
          create_user: 15,
          update_date: '2022-05-24T18:41:42.056Z',
          update_user: 15,
          revision_count: 1
        }
      ];

      sinon.stub(SubmissionService.prototype, 'listSubmissionRecords').resolves(mockResponse);

      const requestHandler = listDataset();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
