import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { UploadArchive } from '../../models/upload-archive';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { ContributorService } from '../contributor-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';
import { UploadArchiveService } from '../upload/upload-archive-service';
import { UploadArtifactService } from '../upload/upload-artifact-service';
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
      status: 'uploaded' as const,
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

    beforeEach(() => {
      sinon.stub(db, 'getAPIUserDBConnection').callsFake(() => {
        const connection = getMockDBConnection();
        connection.open = sinon.stub().resolves();
        connection.commit = sinon.stub().resolves();
        connection.rollback = sinon.stub().resolves();
        connection.release = sinon.stub();
        return connection;
      });
    });

    const setupTarballContext = () => {
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([mockUploadArchive]);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
    };

    it('streams archive in one pass and persists media/codes/features', async () => {
      const service = new SubmissionIngestionService();
      setupTarballContext();

      const deleteFeaturesStub = sinon
        .stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId')
        .resolves();
      const deleteUploadArtifactsStub = sinon
        .stub(UploadArtifactService.prototype, 'deleteUploadArtifactsByUploadId')
        .resolves();
      const contributorByUploadStub = sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 99 } as any);
      const streamArchiveStub = sinon.stub(biohubTarParser, 'streamSubmissionArchive').resolves({
        featureCount: 1,
        uploadedCount: 2,
        codesetFileCount: 1
      });

      const result = await service.ingestSubmissionUpload(mockSubmissionUpload);

      expect(result).to.eql({ valid: true, errors: [] });
      expect(deleteFeaturesStub.calledOnceWithExactly(mockSubmissionUpload.submission_upload_id)).to.be.true;
      expect(deleteUploadArtifactsStub.calledOnceWithExactly(mockSubmissionUpload.upload_id)).to.be.true;
      expect(deleteUploadArtifactsStub.calledBefore(streamArchiveStub)).to.be.true;
      expect(contributorByUploadStub.calledOnceWithExactly(mockSubmissionUpload.submission_upload_id)).to.be.true;
      expect(streamArchiveStub.calledOnce).to.be.true;
    });

    it('throws when archive stream parsing fails', async () => {
      const service = new SubmissionIngestionService();
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(UploadArtifactService.prototype, 'deleteUploadArtifactsByUploadId').resolves();
      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 99 } as any);
      sinon.stub(biohubTarParser, 'streamSubmissionArchive').rejects(new Error('archive stream failed'));

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('archive stream failed');
      }
    });

    it('throws when no upload archives exist for the upload id', async () => {
      const service = new SubmissionIngestionService();

      sinon.stub(UploadArchiveService.prototype, 'getUploadArchivesByUploadId').resolves([]);

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('No archives found for upload upload-1');
      }
    });

    it('propagates archive processing failures', async () => {
      const service = new SubmissionIngestionService();
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(UploadArtifactService.prototype, 'deleteUploadArtifactsByUploadId').resolves();
      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 99 } as any);
      sinon.stub(biohubTarParser, 'streamSubmissionArchive').rejects(new Error('archive persist failed'));

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('archive persist failed');
      }
    });

    it('throws when archive has no features', async () => {
      const service = new SubmissionIngestionService();
      setupTarballContext();

      sinon.stub(SubmissionFeatureIngestionService.prototype, 'deleteFeaturesBySubmissionUploadId').resolves();
      sinon.stub(UploadArtifactService.prototype, 'deleteUploadArtifactsByUploadId').resolves();
      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 99 } as any);
      sinon
        .stub(biohubTarParser, 'streamSubmissionArchive')
        .resolves({ featureCount: 0, uploadedCount: 0, codesetFileCount: 0 });

      try {
        await service.ingestSubmissionUpload(mockSubmissionUpload);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('No feature entries were found under features/ in the archive');
      }
    });
  });
});
