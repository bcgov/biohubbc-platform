import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { ArtifactService } from '../../services/artifact-service';
import * as fileUtils from '../../utils/file-utils';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as intake from './intake';
import { POST } from './intake';

chai.use(sinonChai);

describe('intake', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('media', () => {
          it('is undefined', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: undefined,
                data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                metadata: {
                  title: 'Title',
                  description: 'Description',
                  file_name: 'Filename.txt',
                  file_type: 'Other',
                  file_size: '1'
                }
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'media'");
          });

          it('is null', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: null,
                data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                metadata: {
                  title: 'Title',
                  description: 'Description',
                  file_name: 'Filename.txt',
                  file_type: 'Other',
                  file_size: '1'
                }
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be string');
          });
        });

        describe('data_package_id', () => {
          it('is invalid type', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: 'file-binary',
                data_package_id: 123,
                metadata: {
                  title: 'Title',
                  description: 'Description',
                  file_name: 'Filename.txt',
                  file_type: 'Other',
                  file_size: '1'
                }
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be string');
          });

          it('is invalid format', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: 'file-binary',
                data_package_id: 'abcdefg',
                metadata: {
                  title: 'Title',
                  description: 'Description',
                  file_name: 'Filename.txt',
                  file_type: 'Other',
                  file_size: '1'
                }
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must match format "uuid"');
          });
        });

        describe('metadata', () => {
          it('is undefined', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: 'file-binary',
                data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                metadata: undefined
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'metadata'");
          });

          it('is null', async () => {
            const request = {
              headers: { 'content-type': 'multipart/form-data' },
              body: {
                media: 'file-binary',
                data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                metadata: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be object');
          });

          describe('file_name', () => {
            it('is invalid type', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: 0,
                    file_type: 'Other',
                    file_size: '1'
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is undefined', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: undefined,
                    file_type: 'Other',
                    file_size: '1'
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'file_name'");
              expect(response.errors[0].path).to.equal('metadata.file_name');
            });
          });

          describe('file_type', () => {
            it('is invalid type', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: 'Filename.txt',
                    file_type: 0,
                    file_size: '1'
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is undefined', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: 'Filename.txt',
                    file_type: undefined,
                    file_size: '1'
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'file_type'");
              expect(response.errors[0].path).to.equal('metadata.file_type');
            });
          });

          describe('file_size', () => {
            it('is invalid type', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: 'Filename.txt',
                    file_type: 'Other',
                    file_size: 1000
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is undefined', async () => {
              const request = {
                headers: { 'content-type': 'multipart/form-data' },
                body: {
                  media: 'file-binary',
                  data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
                  metadata: {
                    title: 'Title',
                    description: 'Description',
                    file_name: 'Filename.txt',
                    file_type: 'Other',
                    file_size: undefined
                  }
                }
              };

              const response = requestValidator.validateRequest(request);

              expect(response.status).to.equal(400);
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'file_size'");
              expect(response.errors[0].path).to.equal('metadata.file_size');
            });
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const request = {
            headers: { 'content-type': 'multipart/form-data' },
            body: {
              media: 'file-binary',
              data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
              metadata: {
                file_name: 'Filename.txt',
                file_type: 'Other',
                file_size: '1'
              }
            }
          };

          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });

        it('required and optional values are valid', async () => {
          const request = {
            headers: { 'content-type': 'multipart/form-data' },
            body: {
              media: 'file-binary',
              data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
              metadata: {
                title: 'Title',
                description: 'Description',
                file_name: 'Filename.txt',
                file_type: 'Other',
                file_size: '1'
              }
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
          expect(response.errors[0].message).to.equal('must be object');
        });

        it('returns an empty response', async () => {
          const apiResponse = {};
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal("must have required property 'artifact_id'");
        });

        describe('artifact_id', () => {
          it('is undefined', async () => {
            const apiResponse = { artifact_id: undefined };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'artifact_id'");
          });

          it('is null', async () => {
            const apiResponse = { artifact_id: null };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('is wrong type', async () => {
            const apiResponse = { artifact_id: '1' };
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal('must be integer');
          });
        });
      });

      describe('should succeed when', () => {
        it('required values are valid', async () => {
          const apiResponse = { artifact_id: 1 };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('intakeArtifacts', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error when req.files is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Missing required `media`');
      }
    });

    it('throws an error when two or more files are submitted', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File,
        {
          originalname: 'bbb47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Too many files uploaded, expected 1');
      }
    });

    it('throws an error when media file is detected to be malicious', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(false);

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Malicious content detected, upload cancelled');
      }
    });

    it('throws an error when metadata file size is not a number', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: 'string'
        }
      };

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Metadata file_size must be a non-negative integer');
      }
    });

    it('throws an error when metadata file size is a negative number', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '-1'
        }
      };

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Metadata file_size must be a non-negative integer');
      }
    });

    it('throws an error when zip file has no extension', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('File must be a .zip archive');
      }
    });

    it('throws an error when file is not a zip', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'test.txt'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('File must be a .zip archive');
      }
    });

    it('throws an error when file name does not reflect a valid uuid', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'test.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('File name must reflect a valid UUID');
      }
    });

    it('throws an error when getKeycloakSource returns null', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').returns(null);

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('Failed to identify known submission source system');
      }
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      sinon.stub(ArtifactService.prototype, 'uploadAndPersistArtifact').throws(new Error('test error'));

      const requestHandler = intake.intakeArtifacts();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('returns 200', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        metadata: {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: '1'
        }
      };

      const scanFileForVirusStub = sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getKeycloakSource').resolves(true);

      const uploadStub = sinon
        .stub(ArtifactService.prototype, 'uploadAndPersistArtifact')
        .resolves({ artifact_id: 12 });

      const requestHandler = intake.intakeArtifacts();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(scanFileForVirusStub).to.have.been.calledOnceWith(mockFile);
      expect(uploadStub).to.have.been.calledOnceWith(
        '64f47e65-f306-410e-82fa-115f9916910b',
        {
          title: 'Title',
          description: 'Description',
          file_name: 'Filename.txt',
          file_type: 'Other',
          file_size: 1
        },
        'aaa47e65-f306-410e-82fa-115f9916910b',
        mockFile
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ artifact_id: 12 });
    });
  });
});
