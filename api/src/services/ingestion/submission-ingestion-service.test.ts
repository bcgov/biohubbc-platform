import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { IFlattenedBlock } from '../../models/submission-feature';
import { UploadArchive } from '../../models/upload-archive';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
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

    it('streams features and ingests media/codesets without pre-validation pass', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

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

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      const deleteFeaturesStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId')
        .resolves();
      const ingestFeatureBatchStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .resolves();
      const ingestMediaStub = sinon.stub(MediaIngestionService.prototype, 'ingestMediaFiles').resolves();
      const ingestCodesetsStub = sinon.stub(CodesetIngestionService.prototype, 'ingestCodesets').resolves();

      sinon.stub(biohubTarParser, 'streamFeatures').callsFake(async (_stream, _batchSize, onBatch) => {
        const featureBatch: IFlattenedBlock[] = [
          {
            id: 'feature-1',
            type: 'observation',
            properties: { title: 'test' },
            content: [],
            parent: null
          }
        ];
        await onBatch(featureBatch);
        return { featureCount: 1 };
      });

      const result = await service.ingestSubmissionUpload(mockSubmissionUpload);

      expect(result).to.eql({ valid: true, errors: [] });
      expect(deleteFeaturesStub.calledOnceWithExactly(mockSubmissionUpload.submission_upload_id)).to.be.true;
      expect(ingestMediaStub.calledOnce).to.be.true;
      expect(ingestCodesetsStub.calledOnce).to.be.true;
      expect(ingestFeatureBatchStub.calledOnce).to.be.true;
      sinon.assert.callOrder(ingestMediaStub, ingestCodesetsStub, ingestFeatureBatchStub);
    });

    it('throws when shallow feature stream parsing fails', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

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

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'ingestMediaFiles').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestCodesets').resolves();
      sinon
        .stub(biohubTarParser, 'streamFeatures')
        .rejects(new Error('Feature entry is missing required string field: id'));

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Feature entry is missing required string field: id');
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

    it('propagates media ingestion failures and does not continue to later stages', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

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

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'ingestMediaFiles').rejects(new Error('media upload failed'));
      const ingestCodesetsStub = sinon.stub(CodesetIngestionService.prototype, 'ingestCodesets').resolves();
      const streamFeaturesStub = sinon.stub(biohubTarParser, 'streamFeatures').resolves({ featureCount: 0 });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('media upload failed');
      }

      expect(ingestCodesetsStub.called).to.be.false;
      expect(streamFeaturesStub.called).to.be.false;
    });

    it('propagates codeset ingestion failures and does not stream feature batches', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

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

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'ingestMediaFiles').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestCodesets').rejects(new Error('codeset persist failed'));
      const streamFeaturesStub = sinon.stub(biohubTarParser, 'streamFeatures').resolves({ featureCount: 0 });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('codeset persist failed');
      }

      expect(streamFeaturesStub.called).to.be.false;
    });

    it('propagates feature batch ingestion failures from stream callback', async () => {
      const dbConnection = getMockDBConnection();
      const service = new SubmissionIngestionService(dbConnection);

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

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(MediaIngestionService.prototype, 'ingestMediaFiles').resolves();
      sinon.stub(CodesetIngestionService.prototype, 'ingestCodesets').resolves();
      sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'ingestFeatureBatch')
        .rejects(new Error('insert feature batch failed'));
      sinon.stub(biohubTarParser, 'streamFeatures').callsFake(async (_stream, _batchSize, onBatch) => {
        await onBatch([
          {
            id: 'feature-1',
            type: 'dataset',
            properties: { name: 'x' },
            content: [],
            parent: null
          }
        ]);
        return { featureCount: 1 };
      });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert feature batch failed');
      }
    });
  });
});
