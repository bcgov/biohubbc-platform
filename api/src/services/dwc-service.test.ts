import { S3 } from 'aws-sdk';
import { ManagedUpload } from 'aws-sdk/clients/s3';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { ISecurityModel } from '../repositories/security-repository';
import {
  ISourceTransformModel,
  ISubmissionModel,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { IStyleModel } from '../repositories/validation-repository';
import * as fileUtils from '../utils/file-utils';
import { CSVWorksheet, ICsvState } from '../utils/media/csv/csv-file';
import * as dwcUtils from '../utils/media/dwc/dwc-archive-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState, MediaFile } from '../utils/media/media-file';
import * as mediaUtils from '../utils/media/media-utils';
import { UnknownMedia } from '../utils/media/media-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { DarwinCoreService } from './dwc-service';
import { OccurrenceService } from './occurrence-service';
import { SecurityService } from './security-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

chai.use(sinonChai);

describe('DarwinCoreService', () => {
  describe('scrapeAndUploadOccurrences', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when no s3Key received', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves(null as unknown as ISubmissionModel);

      try {
        await darwinCoreService.scrapeAndUploadOccurrences(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('submission record s3Key unavailable');
      }
    });

    it('should throw an error when no s3File exists', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ input_key: 1 } as unknown as ISubmissionModel);

      sinon.stub(fileUtils, 'getFileFromS3').resolves(null as unknown as S3.GetObjectOutput);

      try {
        await darwinCoreService.scrapeAndUploadOccurrences(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('s3 file unavailable');
      }
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ input_key: 1 } as unknown as ISubmissionModel);

      sinon.stub(fileUtils, 'getFileFromS3').resolves('test' as unknown as S3.GetObjectOutput);
      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').resolves('test' as unknown as DWCArchive);
      sinon.stub(OccurrenceService.prototype, 'scrapeAndUploadOccurrences').resolves([{ occurrence_id: 1 }]);

      sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      const response = await darwinCoreService.scrapeAndUploadOccurrences(1);

      expect(response).to.eql([{ occurrence_id: 1 }]);
    });
  });

  describe('prepDWCArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when media is invalid or empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(null);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should throw an error when media is not a valid DwC Archive File', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns('test' as unknown as MediaFile);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const archiveStub = sinon.createStubInstance(ArchiveFile);
      const dwcStub = sinon.createStubInstance(DWCArchive);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(archiveStub);
      const dwcAStub = sinon.stub(dwcUtils, 'DWCArchive').returns(dwcStub);

      const response = await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);

      expect(response).to.equal(dwcStub);
      expect(dwcAStub).to.be.calledOnce;
    });
  });

  describe('ingestNewDwCADataPackage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mockArchiveFile = {
        rawFile: {
          fileName: 'test'
        },
        extra: {
          eml: {
            buffer: Buffer.from('test')
          }
        }
      };

      const uploadFileToS3Stub = sinon
        .stub(fileUtils, 'uploadFileToS3')
        .resolves('test' as unknown as ManagedUpload.SendData);
      const prepDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'prepDWCArchive')
        .returns(mockArchiveFile as unknown as DWCArchive);
      const insertSubmissionRecordStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecord')
        .resolves({ submission_id: 1 });
      const getSourceTransformRecordBySystemUserIdStub = sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);
      const updateSubmissionRecordInputKeyStub = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordInputKey')
        .resolves({ submission_id: 1 });
      const insertSubmissionStatusStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.ingestNewDwCADataPackage(
        { originalname: 'name' } as unknown as Express.Multer.File,
        { dataPackageId: 'string' }
      );

      expect(response).to.eql({ dataPackageId: 'string', submissionId: 1 });
      expect(uploadFileToS3Stub).to.be.calledOnce;
      expect(prepDWCArchiveStub).to.be.calledOnce;
      expect(insertSubmissionRecordStub).to.be.calledOnce;
      expect(getSourceTransformRecordBySystemUserIdStub).to.be.calledOnce;
      expect(updateSubmissionRecordInputKeyStub).to.be.calledOnce;
      expect(insertSubmissionStatusStub).to.be.calledOnce;
    });
  });

  describe('transformAndUploadMetaData', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if there is no eml_source in the submission record', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ id: 1 } as unknown as ISubmissionModel);

      try {
        await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The eml source is not available');
      }
    });
  });

  describe('transformEMLtoJSON', () => {
    afterEach(() => {
      sinon.restore();
    });
  });

  describe('validateSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to rejected', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({} as unknown as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves({} as unknown as IStyleModel);
      sinon
        .stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema')
        .resolves({ validation: false, mediaState: {} as unknown as IMediaState });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.validateSubmission(1, 1);

      expect(response).to.eql({ validation: false, mediaState: {} as unknown as IMediaState });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.REJECTED);
    });

    it('should set submission status to DWC validated', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({} as unknown as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves({} as unknown as IStyleModel);
      sinon.stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema').resolves({
        validation: true,
        mediaState: {} as unknown as IMediaState,
        csvState: {} as unknown as ICsvState
      });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.validateSubmission(1, 1);

      expect(response).to.eql({
        validation: true,
        mediaState: {} as unknown as IMediaState,
        csvState: {} as unknown as ICsvState
      });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);
    });
  });

  describe('secureSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to rejected', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SecurityService.prototype, 'getSecuritySchemaBySecurityId').resolves({} as unknown as ISecurityModel);

      sinon.stub(SecurityService.prototype, 'validateSecurityOfSubmission').resolves({ secure: false });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.secureSubmission(1, 1);

      expect(response).to.eql({ secure: false });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.REJECTED);
    });

    it('should set submission status to Secured', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SecurityService.prototype, 'getSecuritySchemaBySecurityId').resolves({} as unknown as ISecurityModel);

      sinon.stub(SecurityService.prototype, 'validateSecurityOfSubmission').resolves({ secure: true });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.secureSubmission(1, 1);

      expect(response).to.eql({ secure: true });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.SECURED);
    });
  });

  describe('uploadToElasticSearch', () => {
    afterEach(() => {
      sinon.restore();
    });
  });

  describe('normalizeSubmissionDWCA', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to rejected', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const inputParams = { test: 'test' } as unknown as DWCArchive;

      sinon.stub(DarwinCoreService.prototype, 'normalizeDWCA').returns('validstring');

      sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordDWCSource')
        .throws('error' as unknown as ApiExecuteSQLError);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      await darwinCoreService.normalizeSubmissionDWCA(1, inputParams);

      expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
        1,
        SUBMISSION_STATUS_TYPE.REJECTED,
        SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
        'update submission record failed'
      );
    });

    it('should set submission status to ingested', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const inputParams = { test: 'test' } as unknown as DWCArchive;

      sinon.stub(DarwinCoreService.prototype, 'normalizeDWCA').returns('validstring');

      sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordDWCSource').resolves({ submission_id: 1 });

      const insertSubmissionStatusStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      await darwinCoreService.normalizeSubmissionDWCA(1, inputParams);

      expect(insertSubmissionStatusStub).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.SUBMISSION_DATA_INGESTED);
    });
  });

  describe('normalizeDWCA', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should normalize dwca and return json string', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const inputParams = {
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const normailizedInputParams = {
        test1: [
          { id: 1, name: 'test' },
          { id: 2, name: 'test' }
        ],
        test2: [
          { id: 1, name: 'test' },
          { id: 2, name: 'test' }
        ]
      };

      const jsonNormalized = JSON.stringify(normailizedInputParams);

      const response = await darwinCoreService.normalizeDWCA(inputParams);

      expect(response).to.eql(jsonNormalized);
    });
  });

  describe('intake', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should replace an existing file if the dataPackageId has previously been submitted', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getSubmissionStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionIdByUUID')
        .resolves({ submission_id: 1 });

      const submissionEndDateStub = sinon
        .stub(SubmissionService.prototype, 'setSubmissionEndDateById')
        .resolves({ submission_id: 1 });

      const createStub = sinon.stub(DarwinCoreService.prototype, 'create').resolves({ dataPackageId: 'dataPackageId' });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      await darwinCoreService.intake(multerFile, 'dataPackageId');
      expect(getSubmissionStub).to.be.calledWith('dataPackageId');
      expect(submissionEndDateStub).to.be.calledWith(1);
      expect(createStub).to.be.calledOnceWith(multerFile, 'dataPackageId');
    });

    it('should create a new submission if the dataPackageId has not previously been submitted', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getSubmissionStub = sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID').resolves();

      const submissionEndDateStub = sinon
        .stub(SubmissionService.prototype, 'setSubmissionEndDateById')
        .resolves({ submission_id: 1 });

      const createStub = sinon.stub(DarwinCoreService.prototype, 'create').resolves({ dataPackageId: 'dataPackageId' });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      await darwinCoreService.intake(multerFile, 'dataPackageId');
      expect(getSubmissionStub).to.be.calledWith('dataPackageId');
      expect(submissionEndDateStub).not.to.be.called;
      expect(createStub).to.be.calledOnceWith(multerFile, 'dataPackageId');
    });
  });

  describe('create', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to rejected and insert an error message when validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon
        .stub(DarwinCoreService.prototype, 'tempValidateSubmission')
        .throws('error' as unknown as ApiGeneralError);

      const transformEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves();

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .resolves();

      const dwcaStub = sinon.createStubInstance(DWCArchive);
      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(dwcaStub);
      const normalizeSubmissionDWCAStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).to.be.calledOnceWith(1, dwcaStub);
        expect(errorStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.REJECTED,
          SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
          'Failed to validate submission record'
        );
      }
    });

    it('should set submission status to rejected and insert an error message when converting EML to JSON fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();

      const transformEMLtoJSONStub = sinon
        .stub(DarwinCoreService.prototype, 'transformEMLtoJSON')
        .throws('error' as unknown as ApiGeneralError);

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .resolves();

      const dwcaStub = sinon.createStubInstance(DWCArchive);
      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(dwcaStub);
      const normalizeSubmissionDWCAStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).to.be.calledOnceWith(1, dwcaStub);
        expect(errorStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.REJECTED,
          SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
          'Failed to convert EML to JSON'
        );
      }
    });

    it('should set submission status to rejected and insert an error message when transforming metadata fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();

      const transformEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves();

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .throws('error' as unknown as ApiGeneralError);

      const dwcaStub = sinon.createStubInstance(DWCArchive);
      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(dwcaStub);
      const normalizeSubmissionDWCAStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).to.be.calledOnceWith(1, dwcaStub);
        expect(errorStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.REJECTED,
          SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
          'Failed to transform and upload metadata'
        );
      }
    });

    it('should set submission status to rejected and insert an error message when normalizing DwCA fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();

      const transformEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves();

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .resolves();

      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .throws('error' as unknown as ApiGeneralError);
      const normalizeSubmissionDWCAStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).not.to.have.been.called;
        expect(errorStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.REJECTED,
          SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
          'Failed to normalize dwca file'
        );
      }
    });

    it('should set submission status to rejected and insert an error message when normalizing DwCA fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();

      const transformEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves();

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .resolves();

      const dwcaStub = sinon.createStubInstance(DWCArchive);
      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(dwcaStub);
      const normalizeSubmissionDWCAStub = sinon
        .stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA')
        .throws('error' as unknown as ApiGeneralError);

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).to.be.calledOnceWith(1, dwcaStub);
        expect(errorStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.REJECTED,
          SUBMISSION_MESSAGE_TYPE.MISCELLANEOUS,
          'Failed to normalize dwca file'
        );
      }
    });

    it('should succeeed and return the data package id', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDwCADataPackageStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });

      const tempValidationStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();

      const transformEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves();

      const transformAndUploadMetaDataStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .resolves();

      const dwcaStub = sinon.createStubInstance(DWCArchive);
      const getSubmissionRecordAndConvertToDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(dwcaStub);
      const normalizeSubmissionDWCAStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      const errorStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves({ submission_status_id: 1, submission_message_id: 1 });

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      try {
        const response = await darwinCoreService.create(multerFile, 'dataPackageId');

        expect(response.dataPackageId).to.equal('dataPackageId');

        expect(ingestNewDwCADataPackageStub).to.be.calledOnceWith(multerFile, { dataPackageId: 'dataPackageId' });
        expect(tempValidationStub).to.be.calledOnceWith(1);
        expect(transformEMLtoJSONStub).to.be.calledOnceWith(1);
        expect(transformAndUploadMetaDataStub).to.be.calledOnceWith(1, 'dataPackageId');
        expect(getSubmissionRecordAndConvertToDWCArchiveStub).to.be.calledOnceWith(1);
        expect(normalizeSubmissionDWCAStub).to.be.calledOnceWith(1, dwcaStub);
        expect(errorStatusAndMessageStub).not.to.have.been.called;
      } catch (actualError) {
        expect.fail();
      }
    });
  });
});
