import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { DarwinCoreService } from '../../../services/dwc-service';
import * as fileUtils from '../../../utils/file-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as create from './create';
import { POST } from './create';

chai.use(sinonChai);

describe('create', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator((POST.apiDoc as unknown) as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('media', () => {
          it('is undefined', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: { media: undefined }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal("must have required property 'media'");
          });

          it('is null', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: { media: null }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal('must be string');
          });
        });

        describe('data_package_id', () => {
          it('is invalid type', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: { media: 'file', data_package_id: 123 }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('is invalid format', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: { media: 'file', data_package_id: 'not a uuid' }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].message).to.equal('must match format "uuid"');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const request = {
            headers: { 'content-type': 'multipart/form-data' },
            body: { media: 'file' }
          };

          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });

        it('required and optional values are valid', async () => {
          const request = {
            headers: { 'content-type': 'multipart/form-data' },
            body: { media: 'file', data_package_id: '64f47e65-f306-410e-82fa-115f9916910b' }
          };

          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator((POST.apiDoc as unknown) as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be object');
        });

        it('returns an empty response', async () => {
          const apiResponse = {};
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal("must have required property 'data_package_id'");
        });

        describe('data_package_id', () => {
          it('is undefined', async () => {
            const apiResponse = { data_package_id: undefined };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'data_package_id'");
          });

          it('is null', async () => {
            const apiResponse = { data_package_id: null };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('is invalid type', async () => {
            const apiResponse = { data_package_id: 123 };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });

          // Skipped as the response validator doesn't currently seem to support format checks
          it.skip('is invalid format', async () => {
            const apiResponse = { data_package_id: 'not a uuid' };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must match format "uuid"');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = { data_package_id: '64f47e65-f306-410e-82fa-115f9916910b' };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('submitDataset', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error when req.files is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [];
      mockReq.body = {
        media: 'file',
        data_package_id: '123-456-789'
      };

      const requestHandler = create.submitDataset();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Missing required `media`');
      }
    });

    it('throws an error when media file is detected to be malicious', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [({ originalname: 'file' } as unknown) as Express.Multer.File];
      mockReq.body = {
        media: 'file',
        data_package_id: '123-456-789'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(false);

      const requestHandler = create.submitDataset();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Malicious content detected, upload cancelled');
      }
    });

    it('throws an error when ingestNewDwCADataPackage fails', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [({ originalname: 'file' } as unknown) as Express.Multer.File];
      mockReq.body = {
        media: 'file',
        data_package_id: '123-456-789'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);

      sinon.stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage').throws(new Error('test error'));

      const requestHandler = create.submitDataset();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
      }
    });

    it('throws an error when scrapeAndUploadOccurrences fails', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [({ originalname: 'file' } as unknown) as Express.Multer.File];
      mockReq.body = {
        media: 'test',
        data_package_id: '123-456-789'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);

      sinon
        .stub(DarwinCoreService.prototype, 'tempValidateSubmission')
        .resolves({ validation: true, mediaState: { fileName: '', fileErrors: [], isValid: true }, csvState: [] });

      sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: '123-456-789', submissionId: 1 });

      sinon.stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurrences').throws(new Error('test error'));

      const requestHandler = create.submitDataset();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
      }
    });

    it('returns 200', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = ({ originalname: 'file' } as unknown) as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'test',
        data_package_id: '123-456-789'
      };

      const scanFileForVirusStub = sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);

      sinon
        .stub(DarwinCoreService.prototype, 'tempValidateSubmission')
        .resolves({ validation: true, mediaState: { fileName: '', fileErrors: [], isValid: true }, csvState: [] });

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: '123-456-789', submissionId: 1 });

      const scrapeAndUploadOccurrencesStub = sinon
        .stub(DarwinCoreService.prototype, 'scrapeAndUploadOccurrences')
        .resolves();

      sinon.stub(DarwinCoreService.prototype, 'transformAndUploadMetaData').resolves();

      const requestHandler = create.submitDataset();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(scanFileForVirusStub).to.have.been.calledOnceWith(mockFile);
      expect(ingestNewDwCADataPackageStub).to.have.been.calledOnceWith(mockFile);
      expect(scrapeAndUploadOccurrencesStub).to.have.been.calledOnceWith(1);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ data_package_id: '123-456-789' });
    });
  });
});
