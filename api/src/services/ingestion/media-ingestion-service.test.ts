import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';
import { MediaIngestionService } from './media-ingestion-service';

describe('MediaIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('persistUploadedMediaBatch', () => {
    it('inserts artifacts and upload_artifact rows for uploaded files', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ArtifactService.prototype, 'insertArtifacts').resolves([
        {
          artifact_id: 'artifact-1',
          artifact_status: 'uploaded',
          bucket: 'gblhvt',
          object_key: 'submissions/123/uploads/submission-upload-1/media/path/to/key.pdf',
          byte_size: '10',
          checksum_sha256: '1'.repeat(64),
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'pdf'
        },
        {
          artifact_id: 'artifact-2',
          artifact_status: 'uploaded',
          bucket: 'gblhvt',
          object_key: 'submissions/123/uploads/submission-upload-1/media/photo-2.jpg',
          byte_size: '20',
          checksum_sha256: '2'.repeat(64),
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'jpg'
        }
      ] as any);

      const insertUploadArtifactsStub = sinon
        .stub(UploadArtifactService.prototype, 'insertUploadArtifacts')
        .resolves([{ upload_artifact_id: 'upload-artifact-1' }] as any);

      await service.persistUploadedMediaBatch('upload-1', 'archive-1', 'submission-upload-1', [
        {
          fileName: 'key.pdf',
          s3Key: 'submissions/123/uploads/submission-upload-1/media/path/to/key.pdf',
          path: 'path/to/key.pdf',
          byteSize: 10,
          checksumSha256: '1'.repeat(64),
          mimetype: 'application/pdf'
        },
        {
          fileName: 'photo-2.jpg',
          s3Key: 'submissions/123/uploads/submission-upload-1/media/photo-2.jpg',
          path: 'photo-2.jpg',
          byteSize: 20,
          checksumSha256: '2'.repeat(64),
          mimetype: 'image/jpeg'
        }
      ]);

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
    });

    it('throws when inserted artifacts cannot be mapped to uploaded media', async () => {
      const dbConnection = getMockDBConnection();
      const service = new MediaIngestionService(dbConnection);

      sinon.stub(ArtifactService.prototype, 'insertArtifacts').resolves([
        {
          artifact_id: 'artifact-1',
          artifact_status: 'uploaded',
          bucket: 'gblhvt',
          object_key: 'submissions/123/uploads/submission-upload-1/media/photo-1.jpg',
          byte_size: '10',
          checksum_sha256: '1'.repeat(64),
          uploaded_at: '2026-01-01T00:00:00Z',
          format: 'jpg'
        }
      ] as any);

      try {
        await service.persistUploadedMediaBatch('upload-1', 'archive-1', 'submission-upload-1', [
          {
            fileName: 'photo-1.jpg',
            s3Key: 'submissions/123/uploads/submission-upload-1/media/other-key.jpg',
            path: 'other-key.jpg',
            byteSize: 10,
            checksumSha256: '1'.repeat(64),
            mimetype: 'image/jpeg'
          }
        ]);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal(
          'Failed to resolve artifact_id for media object_key=submissions/123/uploads/submission-upload-1/media/other-key.jpg'
        );
      }
    });
  });
});
