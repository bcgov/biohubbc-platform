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
    it('streams media, creates pending artifacts, and batch-updates artifacts', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .onFirstCall()
        .resolves({ artifact_id: 'artifact-1' })
        .onSecondCall()
        .resolves({ artifact_id: 'artifact-2' });
      const insertUploadArtifactsStub = sinon
        .stub(UploadArtifactService.prototype, 'insertUploadArtifacts')
        .resolves([{ upload_artifact_id: 'upload-artifact-1' }]);
      const updateArtifactsByIdsStub = sinon
        .stub(ArtifactService.prototype, 'updateArtifactsByIds')
        .resolves([{ artifact_id: 'artifact-1' }, { artifact_id: 'artifact-2' }]);

      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, options) => {
        await options.ingestMediaBatch([
          {
            fileName: 'key.pdf',
            s3Key: 'submissions/123/uploads/submission-upload-1/media/path/to/key.pdf',
            path: 'path/to/key.pdf',
            byteSize: 10,
            checksumSha256: '1'.repeat(64)
          },
          {
            fileName: 'photo-2.jpg',
            s3Key: 'submissions/123/uploads/submission-upload-1/media/photo-2.jpg',
            path: 'photo-2.jpg',
            byteSize: 20,
            checksumSha256: '2'.repeat(64)
          }
        ]);
        return { uploadedCount: 2 };
      });

      await service.ingestMediaFiles('archive/key.tar', 123, 'submission-upload-1', 'upload-1', 'archive-1');

      expect(insertUploadArtifactsStub.calledOnce).to.be.true;
      expect(insertUploadArtifactsStub.firstCall.args[0]).to.deep.equal([
        {
          upload_id: 'upload-1',
          artifact_id: 'artifact-1',
          role: 'attachment',
          upload_archive_id: 'archive-1',
          path: 'path/to/key.pdf'
        },
        {
          upload_id: 'upload-1',
          artifact_id: 'artifact-2',
          role: 'attachment',
          upload_archive_id: 'archive-1',
          path: 'photo-2.jpg'
        }
      ]);

      expect(updateArtifactsByIdsStub.calledOnce).to.be.true;
      expect(updateArtifactsByIdsStub.firstCall.args[0]).to.have.length(2);
      expect(updateArtifactsByIdsStub.firstCall.args[0][0]).to.include({
        artifact_id: 'artifact-1',
        artifact_status: 'uploaded',
        checksum_sha256: '1'.repeat(64)
      });
      expect(updateArtifactsByIdsStub.firstCall.args[0][1]).to.include({
        artifact_id: 'artifact-2',
        artifact_status: 'uploaded',
        checksum_sha256: '2'.repeat(64)
      });
    });

    it('propagates stream extraction failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(biohubTarParser, 'streamMedia').rejects(new Error('media stream extraction failed'));

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'submission-upload-1', 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('media stream extraction failed');
      }
    });

    it('propagates upload_artifact insert failures after stub creation', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-1' } as any);
      sinon
        .stub(UploadArtifactService.prototype, 'insertUploadArtifacts')
        .rejects(new Error('insert upload_artifact failed'));
      sinon.stub(biohubTarParser, 'streamMedia').callsFake(async (_stream, options) => {
        await options.ingestMediaBatch([
          {
            fileName: 'photo-1.jpg',
            s3Key: 'submissions/123/uploads/submission-upload-1/media/photo-1.jpg',
            path: 'photo-1.jpg',
            byteSize: 10,
            checksumSha256: '1'.repeat(64)
          }
        ]);
        return { uploadedCount: 1 };
      });

      try {
        await service.ingestMediaFiles('archive/key.tar', 123, 'submission-upload-1', 'upload-1', 'archive-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('insert upload_artifact failed');
      }
    });
  });
});
