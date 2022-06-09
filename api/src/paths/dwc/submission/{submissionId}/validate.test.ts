import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { ApiGeneralError } from '../../../../errors/api-error';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as validate from './validate';
import { POST } from './validate';

chai.use(sinonChai);

describe('validate', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator((POST.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

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
      const responseValidator = new OpenAPIResponseValidator((POST.apiDoc as unknown) as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        describe('required return properties is missing', () => {
          it('is missing validation', async () => {
            const apiResponse = {};
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'validation'");
          });

          it('is missing mediaState', async () => {
            const apiResponse = { validation: true };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'mediaState'");
          });

          it('mediaState is missing fileName', async () => {
            const apiResponse = { validation: true, mediaState: {} };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'fileName'");
          });

          it('mediaState is missing isValid', async () => {
            const apiResponse = { validation: true, mediaState: { fileName: '', fileErrors: [] } };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'isValid'");
          });
        });

        describe('return properties are invalid types', () => {
          it('has null value', async () => {
            const apiResponse = null;
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('validation is wrong type', async () => {
            const apiResponse = { validation: '', mediaState: {} };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be boolean');
          });

          it('mediaState is wrong type', async () => {
            const apiResponse = { validation: true, mediaState: 1 };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('mediaState.fileName is wrong type', async () => {
            const apiResponse = { validation: true, mediaState: { fileName: 1, fileErrors: [], isValid: false } };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('mediaState.fileErrors is wrong type', async () => {
            const apiResponse = { validation: true, mediaState: { fileName: '', fileErrors: '', isValid: false } };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('mediaState.fileErrors[] is wrong type', async () => {
            const apiResponse = { validation: true, mediaState: { fileName: '', fileErrors: [1], isValid: false } };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('mediaState.isValid is wrong type', async () => {
            const apiResponse = { validation: true, mediaState: { fileName: '', fileErrors: [], isValid: '' } };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be boolean');
          });
        });
      });
      describe('should succeed when', () => {
        it('has valid values', async () => {
          const apiResponse = { validation: true, mediaState: { fileName: '', fileErrors: [], isValid: true } };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('validateSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('validates submission file then returns 200 and validation object', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon
        .stub(DarwinCoreService.prototype, 'tempValidateSubmission')
        .resolves({ validation: true, mediaState: { fileName: '', fileErrors: [], isValid: true }, csvState: [] });

      const requestHandler = validate.validateSubmission();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        validation: true,
        mediaState: { fileName: '', fileErrors: [], isValid: true },
        csvState: []
      });
    });

    it('should throw an error if validateSubmission throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: '1' };

      sinon.stub(DarwinCoreService.prototype, 'validateSubmission').throws(('error' as unknown) as ApiGeneralError);

      try {
        const requestHandler = validate.validateSubmission();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });
  });
});
