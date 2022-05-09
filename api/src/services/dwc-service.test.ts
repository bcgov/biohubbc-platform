import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { DarwinCoreService } from './dwc-service';
import { SubmissionService } from './submission-service';
import { ISubmissionModel } from '../repositories/submission-repository';
import { ApiGeneralError } from '../errors/api-error';
import * as fileUtils from '../utils/file-utils';
import * as mediaUtils from '../utils/media/media-utils';
import * as dwcUtils from '../utils/media/dwc/dwc-archive-file';
import { S3 } from 'aws-sdk';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { OccurrenceService } from './occurrence-service';
import { UnknownMedia } from '../utils/media/media-utils';
import { ArchiveFile, MediaFile } from '../utils/media/media-file';

chai.use(sinonChai);

describe.only('DarwinCoreService', () => {
  describe('scrapeAndUploadOccurences', () => {
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
        await darwinCoreService.scrapeAndUploadOccurences(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('s3Key submissionRecord unavailable');
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
        await darwinCoreService.scrapeAndUploadOccurences(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('s3File unavailable');
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

      const response = await darwinCoreService.scrapeAndUploadOccurences(1);

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
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission, file was empty');
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
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to parse submission, not a valid DwC Archive Zip file'
        );
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
});
