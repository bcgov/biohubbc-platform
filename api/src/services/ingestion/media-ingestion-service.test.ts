import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { getMockDBConnection } from '../../__mocks__/db';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';
import { MediaIngestionService } from './media-ingestion-service';

describe('MediaIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestMediaFiles', () => {
    it('persists extracted media artifacts with upload_archive lineage', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .onFirstCall()
        .resolves({ artifact_id: 'artifact-1' })
        .onSecondCall()
        .resolves({ artifact_id: 'artifact-2' });
      const insertUploadArtifactStub = sinon.stub(UploadArtifactService.prototype, 'insertUploadArtifact').resolves({
        upload_artifact_id: 'upload-artifact-1'
      });
      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, _storage, _prefix, onUploaded) => {
        await onUploaded?.({
          fileName: 'photo-1.jpg',
          s3Key: 'submissions/123/media/photo-1.jpg',
          path: 'photo-1.jpg',
          byteSize: 10,
          checksumSha256: '1'.repeat(64)
        });
        await onUploaded?.({
          fileName: 'photo-2.jpg',
          s3Key: 'submissions/123/media/photo-2.jpg',
          path: 'photo-2.jpg',
          byteSize: 20,
          checksumSha256: '2'.repeat(64)
        });
        return { uploadedCount: 2 };
      });

      await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');

      expect(insertUploadArtifactStub.callCount).to.equal(2);
      expect(insertUploadArtifactStub.firstCall.args[0]).to.deep.equal({
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        role: 'attachment',
        upload_archive_id: 'archive-1',
        path: 'photo-1.jpg'
      });
      expect(insertUploadArtifactStub.secondCall.args[0]).to.deep.equal({
        upload_id: 'upload-1',
        artifact_id: 'artifact-2',
        role: 'attachment',
        upload_archive_id: 'archive-1',
        path: 'photo-2.jpg'
      });
    });

    it('propagates object storage extraction failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(biohubTarParser, 'streamMedia').rejects(new Error('media stream extraction failed'));

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('media stream extraction failed');
      }
    });

    it('propagates artifact insert failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').rejects(new Error('insert artifact failed'));
      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, _storage, _prefix, onUploaded) => {
        await onUploaded?.({
          fileName: 'photo-1.jpg',
          s3Key: 'submissions/123/media/photo-1.jpg',
          path: 'photo-1.jpg',
          byteSize: 10,
          checksumSha256: '1'.repeat(64)
        });
        return { uploadedCount: 1 };
      });

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert artifact failed');
      }
    });

    it('propagates upload_artifact insert failures after artifact creation', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-1' } as any);
      sinon
        .stub(UploadArtifactService.prototype, 'insertUploadArtifact')
        .rejects(new Error('insert upload_artifact failed'));
      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, _storage, _prefix, onUploaded) => {
        await onUploaded?.({
          fileName: 'photo-1.jpg',
          s3Key: 'submissions/123/media/photo-1.jpg',
          path: 'photo-1.jpg',
          byteSize: 10,
          checksumSha256: '1'.repeat(64)
        });
        return { uploadedCount: 1 };
      });

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert upload_artifact failed');
      }
    });

    it('delegates upload_artifact persistence to UploadArtifactService', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-1' } as any);
      const insertUploadArtifactStub = sinon.stub(UploadArtifactService.prototype, 'insertUploadArtifact').resolves({
        upload_artifact_id: 'upload-artifact-1'
      });
      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, _storage, _prefix, onUploaded) => {
        await onUploaded?.({
          fileName: 'photo-1.jpg',
          s3Key: 'submissions/123/media/photo-1.jpg',
          path: 'photo-1.jpg',
          byteSize: 10,
          checksumSha256: '1'.repeat(64)
        });
        return { uploadedCount: 1 };
      });

      await service.ingestMediaFiles('archive/key.tar', 123, 'upload-1', 'archive-1');

      expect(insertUploadArtifactStub.calledOnce).to.be.true;
    });
  });
});
