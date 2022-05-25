import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionService } from '../../../../services/submission-service';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getSubmissionSignedUrl } from './getSignedUrl';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import { GET } from './getSignedUrl';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import { HTTPError } from '../../../../errors/http-error';
import * as fileUtils from '../../../../utils/file-utils';
import { ApiGeneralError } from '../../../../errors/api-error';
import { ISubmissionModel } from '../../../../repositories/submission-repository';

chai.use(sinonChai);

describe('getSubmissionSignedUrl', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator((GET.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

      const basicRequest = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {}
      };

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const request = { ...basicRequest, params: { submissionId: null } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has negative value', async () => {
          const request = { ...basicRequest, params: { submissionId: -1 } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be >= 0');
        });

        it('has string value', async () => {
          const request = { ...basicRequest, params: { submissionId: 'string' } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be integer');
        });

        it('has invalid key', async () => {
          const request = { ...basicRequest, params: { id: 1 } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal("must have required property 'submissionId'");
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const request = { ...basicRequest, params: { submissionId: 1 } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator((GET.apiDoc as unknown) as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('has null value', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be string');
        });

        it('has invalid key value', async () => {
          const apiResponse = { id: 1 };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be string');
        });
      });

      describe('should succeed when', () => {
        it('has valid values', async () => {
          const apiResponse = 'valid String';
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('getSubmissionSignedUrl', () => {
    it('throw a 400 error when no input_key is present', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockServiceResponse = ({
        input_key: null
      } as unknown) as ISubmissionModel;

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves(mockServiceResponse);

      try {
        const requestHandler = getSubmissionSignedUrl();
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Failed to find submission S3 key.');
      }
    });

    it('throw a 400 error when no signedS3Url is returned', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockServiceResponse = ({
        input_key: 'test-signed-url'
      } as unknown) as ISubmissionModel;

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves(mockServiceResponse);
      sinon.stub(fileUtils, 'getS3SignedURL').resolves(null);

      try {
        const requestHandler = getSubmissionSignedUrl();
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Failed to retreive signed S3 URL from the given S3 key.');
      }
    });

    it('should throw an error if getSubmissionSignedUrl throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .throws(('error' as unknown) as ApiGeneralError);

      try {
        const requestHandler = getSubmissionSignedUrl();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });

    it('should return a signed URL upon success', async () => {
      const mockDBConnection = getMockDBConnection();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const testResponseSignedUrl = 'test-signed-url';
      const mockServiceResponse = {
        submission_id: 1,
        source: 'SIMS',
        uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
        event_timestamp: '2022-05-24T18:41:42.211Z',
        delete_timestamp: null,
        input_key: testResponseSignedUrl,
        input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        eml_source: null,
        darwin_core_source: 'test',
        create_date: '2022-05-24T18:41:42.056Z',
        create_user: 15,
        update_date: '2022-05-24T18:41:42.056Z',
        update_user: 15,
        revision_count: 1
      };

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves(mockServiceResponse);
      sinon.stub(fileUtils, 'getS3SignedURL').resolves(testResponseSignedUrl);

      const requestHandler = getSubmissionSignedUrl();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.sendValue).to.eql(testResponseSignedUrl);
    });
  });
});
