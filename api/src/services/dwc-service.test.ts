import { S3 } from 'aws-sdk';
import { ManagedUpload } from 'aws-sdk/clients/s3';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { ISourceTransformModel, ISubmissionModel, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { IStyleModel } from '../repositories/validation-repository';
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
        .resolves((null as unknown) as ISubmissionModel);

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
        .resolves(({ input_key: 1 } as unknown) as ISubmissionModel);

      sinon.stub(fileUtils, 'getFileFromS3').resolves((null as unknown) as S3.GetObjectOutput);

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
        .resolves(({ input_key: 1 } as unknown) as ISubmissionModel);

      sinon.stub(fileUtils, 'getFileFromS3').resolves(('test' as unknown) as S3.GetObjectOutput);
      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').resolves(('test' as unknown) as DWCArchive);
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
        await darwinCoreService.prepDWCArchive(('test' as unknown) as UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should throw an error when media is not a valid DwC Archive File', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(('test' as unknown) as MediaFile);

      try {
        await darwinCoreService.prepDWCArchive(('test' as unknown) as UnknownMedia);
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

      const response = await darwinCoreService.prepDWCArchive(('test' as unknown) as UnknownMedia);

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

      sinon.stub(fileUtils, 'uploadFileToS3').resolves(('test' as unknown) as ManagedUpload.SendData);
      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').returns((mockArchiveFile as unknown) as DWCArchive);
      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 1 });
      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves(({ source_transform_id: 1 } as unknown) as ISourceTransformModel);
      sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordInputKey').resolves({ submission_id: 1 });
      sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.ingestNewDwCADataPackage(
        ({ originalname: 'name' } as unknown) as Express.Multer.File,
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
        .resolves(({} as unknown) as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves(({} as unknown) as IStyleModel);
      sinon
        .stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema')
        .resolves({ validation: false, mediaState: ({} as unknown) as IMediaState });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.validateSubmission(1, 1);

      expect(response).to.eql({ validation: false, mediaState: ({} as unknown) as IMediaState });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.REJECTED);
    });

    it('should set submission status to DWC validated', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(({} as unknown) as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves(({} as unknown) as IStyleModel);
      sinon.stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema').resolves({
        validation: true,
        mediaState: ({} as unknown) as IMediaState,
        csvState: ({} as unknown) as ICsvState
      });

      const mockInsertStatus = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatus')
        .resolves({ submission_status_id: 1, submission_status_type_id: 1 });

      const response = await darwinCoreService.validateSubmission(1, 1);

      expect(response).to.eql({
        validation: true,
        mediaState: ({} as unknown) as IMediaState,
        csvState: ({} as unknown) as ICsvState
      });
      expect(mockInsertStatus).to.be.calledOnceWith(1, SUBMISSION_STATUS_TYPE.DARWIN_CORE_VALIDATED);
    });
  });
});
