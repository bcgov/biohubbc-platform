//import { Client } from '@elastic/elasticsearch';
import { ShardStatistics } from '@elastic/elasticsearch/lib/api/types';
import { S3 } from 'aws-sdk';
import { GetObjectOutput, ManagedUpload } from 'aws-sdk/clients/s3';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { ISourceTransformModel, ISubmissionModel, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { IStyleModel } from '../repositories/validation-repository';
//import { ESService } from '../services/es-service';
import * as fileUtils from '../utils/file-utils';
import { ICsvState } from '../utils/media/csv/csv-file';
import * as dwcUtils from '../utils/media/dwc/dwc-archive-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState, MediaFile } from '../utils/media/media-file';
import * as mediaUtils from '../utils/media/media-utils';
import { UnknownMedia } from '../utils/media/media-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { DarwinCoreService } from './dwc-service';
import { OccurrenceService } from './occurrence-service';
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
      sinon.stub(dwcUtils, 'DWCArchive').returns(dwcStub);

      const response = await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);

      expect(response).to.equal(dwcStub);
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

      sinon.stub(fileUtils, 'uploadFileToS3').resolves('test' as unknown as ManagedUpload.SendData);
      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').returns(mockArchiveFile as unknown as DWCArchive);
      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });
      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);
      sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordInputKey').resolves({ submission_id: 1 });
      sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.ingestNewDwCADataPackage(
        { originalname: 'name' } as unknown as Express.Multer.File,
        { dataPackageId: 'string' }
      );

      expect(response).to.eql({ dataPackageId: 'string', submissionId: 1 });
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

    it('throws an error if the function is not able to get the stylesheet from S3', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ id: 1, eml_source: 'some eml source' } as unknown as ISubmissionModel);

      sinon.stub(SubmissionService.prototype, 'getStylesheetFromS3').resolves(null as unknown as GetObjectOutput);

      try {
        await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The transformation stylesheet is not available');
      }
    });

    it.only('successfully transforms EML to JSON with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        id: 1,
        eml_source: `<?xml version="1.0" encoding="UTF-8"?>
        <note>
          <to>Tove</to>
          <from>Jani</from>
          <heading>Reminder</heading>
          <body>Don't forget me this weekend!</body>
        </note>`
      } as unknown as ISubmissionModel);

      //todo: make this a valid s3 file
      const s3File = {
        LastModified: '2022-06-06T20:49:29.000Z',
        ContentLength: 41760,
        ETag: '"1312ae50d1f8004793f7f0836aa67459"',
        VersionId: '1654548539910',
        Metadata: {},
        ContentType: 'application/json',
        Body: Buffer.from('file1data')
      } as unknown as GetObjectOutput;

      sinon.stub(SubmissionService.prototype, 'getStylesheetFromS3').resolves(s3File);

      sinon.stub(mediaUtils, 'parseS3File').resolves(null as unknown as MediaFile);

      sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves({ id: 'new_id' });

      sinon.stub(DarwinCoreService.prototype, 'uploadtoElasticSearch').resolves({
        _id: 'id',
        _index: 'eml',
        _primary_term: 1234,
        result: 'created',
        _seq_no: 1234,
        _shards: {
          failed: 0,
          successful: 1,
          total: 1
        } as unknown as ShardStatistics,
        _version: 3
      });

      const result = await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');

      expect(result[0].id).equal('new_id');
    });

    // it.skip('throws an error when getting the Elastic Search service fails', async () => {
    //   const mockDBConnection = getMockDBConnection();
    //   const darwinCoreService = new DarwinCoreService(mockDBConnection);

    //   sinon
    //     .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
    //     .resolves({ id: 1, eml_source: {} } as unknown as ISubmissionModel);

    //   sinon.stub(ESService.prototype, 'getEsClient').resolves(undefined);

    //   try {
    //     await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
    //     expect.fail();
    //   } catch (actualError) {
    //     expect((actualError as Error).message).to.equal("Cannot read property 'rowCount' of undefined");
    //   }
    // });

    // it.skip('inserts a record in elastic search with valid data and connection', async () => {
    //   const mockDBConnection = getMockDBConnection();
    //   const darwinCoreService = new DarwinCoreService(mockDBConnection);

    //   sinon
    //     .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
    //     .resolves({ id: 1, eml_source: {} } as unknown as ISubmissionModel);
    //   sinon
    //     .stub(SubmissionService.prototype, 'insertSubmissionStatus')
    //     .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

    //   sinon.stub(DarwinCoreService.prototype, 'transformEMLtoJSON').resolves(`{"id": "1", "value": "some_value"}`);

    //   const createStub = sinon.stub().resolves({
    //     _index: 'eml',
    //     _type: '_doc',
    //     _id: '7fbcbd82-a6c4-4127-982e-dc72b4d166b4',
    //     _version: 1,
    //     result: 'created',
    //     _shards: { total: 2, successful: 2, failed: 0 },
    //     _seq_no: 26,
    //     _primary_term: 1
    //   });

    //   sinon.stub(ESService.prototype, 'getEsClient').resolves({
    //     create: createStub
    //   } as unknown as Client);

    //   const response = await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
    //   expect(response).eql({
    //     _index: 'eml',
    //     _type: '_doc',
    //     _id: '7fbcbd82-a6c4-4127-982e-dc72b4d166b4',
    //     _version: 1,
    //     result: 'created',
    //     _shards: { total: 2, successful: 2, failed: 0 },
    //     _seq_no: 26,
    //     _primary_term: 1
    //   });
    // });
  });
});
