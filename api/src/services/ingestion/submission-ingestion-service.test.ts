import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { UploadArchive } from '../../models/upload-archive';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { getMockDBConnection } from '../../__mocks__/db';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { CodesetIngestionService } from './codeset-ingestion-service';
import { MediaIngestionService } from './media-ingestion-service';
import { SubmissionFeatureIngestionService } from './submission-feature-ingestion-service';
import { SubmissionIngestionService } from './submission-ingestion-service';

describe('SubmissionIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestSubmissionUpload', () => {
    const mockSubmissionUpload = {
      submission_upload_id: 'sub-upload-uuid-1',
      submission_id: 123,
      upload_id: 'upload-1',
      status: 'pending' as const,
      ticket_id: '11111111-1111-1111-1111-111111111111'
    };

    const mockUploadArchive: UploadArchive = {
      upload_archive_id: 'archive-1',
      upload_id: 'upload-1',
      artifact_id: 'artifact-1',
      archive_status: 'pending'
    };

    const mockArtifact: Artifact = {
      artifact_id: 'artifact-1',
      artifact_status: ArtifactStatusEnum.UPLOADED,
      bucket: 'test-bucket',
      object_key: 'submissions/123/uploads/upload-1.tar',
      byte_size: '1000',
      checksum_sha256: null,
      uploaded_at: '2025-01-01T00:00:00Z',
      format: 'tar'
    };

    const setupTarballContext = () => {
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
    };

    it('streams archive in one pass and persists media/codes/features', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      const deleteFeaturesStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId')
        .resolves();
      const ingestFeatureBatchStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .resolves();
      const persistMediaBatchStub = sinon.stub(MediaIngestionService.prototype, 'persistUploadedMediaBatch').resolves();
      const ingestParsedCodesetsStub = sinon.stub(CodesetIngestionService.prototype, 'ingestParsedCodesets').resolves();

      sinon.stub(biohubTarParser, 'streamSubmissionArchive').callsFake(async (_stream, options) => {
        await options.ingestMediaBatch([
          {
            fileName: 'photo.jpg',
            s3Key: 'submissions/123/uploads/sub-upload-uuid-1/media/photo.jpg',
            path: 'photo.jpg',
            byteSize: 10,
            checksumSha256: 'a'.repeat(64),
            mimetype: 'image/jpeg'
          }
        ]);
        await options.ingestCodesets({
          agency: {
            key: 'agency',
            label: 'Agency',
            external_id: 'agency',
            description: null,
            codes: {
              x: {
                key: 'x',
                label: 'X',
                external_id: 'x',
                description: null
              }
            }
          }
        });
        await options.ingestFeatureBatch([
          {
            id: 'feature-1',
            type: 'dataset',
            properties: { name: 'Dataset' },
            content: [],
            parent: null
          }
        ]);

        return { uploadedCount: 1, featureCount: 1, codesetFileCount: 1 };
      });

      const result = await service.ingestSubmissionUpload(mockSubmissionUpload);

      expect(result).to.eql({ valid: true, errors: [] });
      expect(deleteFeaturesStub.calledOnceWithExactly(mockSubmissionUpload.submission_upload_id)).to.be.true;
      expect(persistMediaBatchStub.calledOnce).to.be.true;
      expect(ingestParsedCodesetsStub.calledOnce).to.be.true;
      expect(ingestFeatureBatchStub.calledOnce).to.be.true;
    });

    it('throws when archive parser fails', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(biohubTarParser, 'streamSubmissionArchive').rejects(new Error('archive stream failed'));

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('archive stream failed');
      }
    });

    it('throws when no upload archives exist for the upload id', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([]);

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('No archives found for upload upload-1');
      }
    });

    it('propagates media persistence failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon
        .stub(MediaIngestionService.prototype, 'persistUploadedMediaBatch')
        .rejects(new Error('media persist failed'));
      const ingestParsedCodesetsStub = sinon.stub(CodesetIngestionService.prototype, 'ingestParsedCodesets').resolves();
      const ingestFeatureBatchStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .resolves();

      sinon.stub(biohubTarParser, 'streamSubmissionArchive').callsFake(async (_stream, options) => {
        await options.ingestMediaBatch([
          {
            fileName: 'photo.jpg',
            s3Key: 'submissions/123/uploads/sub-upload-uuid-1/media/photo.jpg',
            path: 'photo.jpg',
            byteSize: 10,
            checksumSha256: 'a'.repeat(64),
            mimetype: 'image/jpeg'
          }
        ]);
        return { uploadedCount: 1, featureCount: 1, codesetFileCount: 0 };
      });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('media persist failed');
      }

      expect(ingestParsedCodesetsStub.called).to.be.false;
      expect(ingestFeatureBatchStub.called).to.be.false;
    });

    it('propagates codeset persistence failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'persistUploadedMediaBatch').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestParsedCodesets').rejects(new Error('codeset persist failed'));
      const ingestFeatureBatchStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .resolves();

      sinon.stub(biohubTarParser, 'streamSubmissionArchive').callsFake(async (_stream, options) => {
        await options.ingestCodesets({
          agency: {
            key: 'agency',
            label: 'Agency',
            external_id: 'agency',
            description: null,
            codes: {}
          }
        });
        return { uploadedCount: 0, featureCount: 1, codesetFileCount: 1 };
      });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('codeset persist failed');
      }

      expect(ingestFeatureBatchStub.called).to.be.false;
    });

    it('propagates feature batch persistence failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'persistUploadedMediaBatch').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestParsedCodesets').resolves();
      sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .rejects(new Error('insert feature batch failed'));

      sinon.stub(biohubTarParser, 'streamSubmissionArchive').callsFake(async (_stream, options) => {
        await options.ingestFeatureBatch([
          {
            id: 'feature-1',
            type: 'dataset',
            properties: { name: 'x' },
            content: [],
            parent: null
          }
        ]);
        return { uploadedCount: 0, featureCount: 1, codesetFileCount: 0 };
      });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert feature batch failed');
      }
    });

    it('throws when archive has no features', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'persistUploadedMediaBatch').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestParsedCodesets').resolves();
      sinon.stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch').resolves();
      sinon
        .stub(biohubTarParser, 'streamSubmissionArchive')
        .resolves({ uploadedCount: 1, featureCount: 0, codesetFileCount: 1 });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('No feature entries were found under features/ in the archive');
      }
    });
  });
});
