import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { v4 } from 'uuid';
import { IDBConnection } from '../../database/db';
import { HTTP401 } from '../../errors/http-error';
import { UploadStatusEnum } from '../../models/upload';
import { ICreateSubmission } from '../../repositories/submission-repository';
import * as fileUtils from '../../utils/file-utils';
import * as submissionUploadUtils from '../../utils/submission-upload-utils';
import { SubmissionService } from '../submission-service';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';
import { UploadIngestionService } from './upload-ingestion-service';
import { UploadService } from './upload-service';

chai.use(sinonChai);

describe('UploadIngestionService', () => {
  let mockConnection: IDBConnection;
  let service: UploadIngestionService;

  const mockSubmission: ICreateSubmission = {
    uuid: v4(),
    system_user_id: 1,
    source_system: 'SIMS',
    name: 'Test Submission',
    description: 'Test Description',
    comment: 'Test Comment'
  };

  beforeEach(() => {
    mockConnection = {
      systemUserId: () => 1
    } as unknown as IDBConnection;

    service = new UploadIngestionService(mockConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('startArchiveUpload', () => {
    it('should create submission, upload, artifact, and generate presigned URLs on success', async () => {
      const mockSubmissionId = 123;
      const mockUploadId = 'upload-456';
      const mockArtifactId = 'artifact-789';
      const mockUploadArchiveId = 'upload-archive-999';
      const mockS3UploadId = 's3-upload-111';
      const mockBytes = 5_000_000;

      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: mockSubmissionId });

      sinon.stub(UploadService.prototype, 'insertUpload').resolves({
        upload_id: mockUploadId
      });

      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });

      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({
        artifact_id: mockArtifactId
      });

      sinon.stub(UploadArchiveService.prototype, 'insertUploadArchive').resolves({
        upload_archive_id: mockUploadArchiveId
      });

      sinon.stub(submissionUploadUtils, 'generateMultipartUploadPresignedUrls').resolves({
        uploadId: mockS3UploadId,
        presignedUrls: [
          { partNumber: 1, url: 'https://s3-url-1' },
          { partNumber: 2, url: 'https://s3-url-2' }
        ],
        partSizeBytes: 5_000_000,
        partCount: 2
      });

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: mockUploadId });

      const result = await service.startArchiveUpload(mockBytes, mockSubmission);

      expect(result).to.have.property('submissionId', mockSubmissionId);
      expect(result).to.have.property('uploadId', mockUploadId);
      expect(result).to.have.property('uploadArchiveId', mockUploadArchiveId);
      expect(result).to.have.property('s3UploadId', mockS3UploadId);
      expect(result).to.have.property('partCount', 2);
      expect(result.presignedUrls).to.have.length(2);
    });

    it('should throw if submission creation fails', async () => {
      sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecord')
        .rejects(new Error('Database error: submission insert failed'));

      try {
        await service.startArchiveUpload(5_000_000, mockSubmission);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('submission insert failed');
      }
    });

    it('should throw if upload creation fails', async () => {
      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 123 });

      sinon.stub(UploadService.prototype, 'insertUpload').rejects(new Error('Database error: upload insert failed'));

      try {
        await service.startArchiveUpload(5_000_000, mockSubmission);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('upload insert failed');
      }
    });

    it('should throw if artifact creation fails', async () => {
      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 123 });

      sinon.stub(UploadService.prototype, 'insertUpload').resolves({
        upload_id: 'upload-456'
      });

      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });

      sinon
        .stub(ArtifactService.prototype, 'insertArtifact')
        .rejects(new Error('Database error: artifact insert failed'));

      try {
        await service.startArchiveUpload(5_000_000, mockSubmission);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('artifact insert failed');
      }
    });

    it('should throw if presigned URL generation fails', async () => {
      sinon.stub(SubmissionService.prototype, 'insertSubmissionRecord').resolves({ submission_id: 123 });

      sinon.stub(UploadService.prototype, 'insertUpload').resolves({
        upload_id: 'upload-456'
      });

      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });

      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({
        artifact_id: 'artifact-789'
      });

      sinon.stub(UploadArchiveService.prototype, 'insertUploadArchive').resolves({
        upload_archive_id: 'upload-archive-999'
      });

      sinon
        .stub(submissionUploadUtils, 'generateMultipartUploadPresignedUrls')
        .rejects(new Error('S3 error: failed to generate presigned URLs'));

      try {
        await service.startArchiveUpload(5_000_000, mockSubmission);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('presigned URLs');
      }
    });
  });

  describe('completeArchiveUpload', () => {
    const mockParams = {
      uploadId: 'upload-456',
      s3UploadId: 's3-upload-111',
      key: 'submissions/submission-123/uploads/upload-456.tar',
      parts: [
        { PartNumber: 1, ETag: 'etag-1' },
        { PartNumber: 2, ETag: 'etag-2' }
      ]
    };

    it('should complete upload successfully with all updates and S3 operations', async () => {
      const futureDate = dayjs().add(30, 'minute').toISOString();

      const getUploadStub = sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.PENDING,
        record_end_date: futureDate,
        create_user: 1
      });

      const updateUploadStub = sinon
        .stub(UploadService.prototype, 'updateUpload')
        .resolves({ upload_id: 'upload-456' });
      const updateArtifactsStub = sinon
        .stub(ArtifactService.prototype, 'updateArtifactsByUploadId')
        .resolves([{ artifact_id: 'artifact-1' }]);
      const updateArchivesStub = sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId')
        .resolves([{ upload_archive_id: 'upload-archive-id' }]);

      const s3ClientStub = {
        send: sinon.stub().resolves({ ETag: 'etag' })
      };
      sinon.stub(fileUtils, 'getQuarantineS3Client').returns(s3ClientStub as any);
      sinon.stub(fileUtils, 'getQuarantineObjectStoreBucketName').returns('quarantine-bucket');

      await service.completeArchiveUpload(mockParams);

      expect(getUploadStub).to.have.been.calledWith('upload-456');
      expect(updateUploadStub).to.have.been.called;
      expect(updateArtifactsStub).to.have.been.called;
      expect(updateArchivesStub).to.have.been.called;
      expect(s3ClientStub.send).to.have.been.calledOnce;
    });

    it('should throw HTTP401 if upload s3_upload_id does not match', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 'wrong-s3-id',
        status: UploadStatusEnum.PENDING,
        record_end_date: dayjs().add(30, 'minute').toISOString(),
        create_user: 1
      });

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload creator does not match current user', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.PENDING,
        record_end_date: dayjs().add(30, 'minute').toISOString(),
        create_user: 999
      });

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload is not in PENDING status', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.COMPLETED,
        record_end_date: dayjs().add(30, 'minute').toISOString(),
        create_user: 1
      });

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload record_end_date has passed', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.PENDING,
        record_end_date: dayjs().subtract(5, 'minute').toISOString(),
        create_user: 1
      });

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw if S3 multipart completion fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.PENDING,
        record_end_date: dayjs().add(30, 'minute').toISOString(),
        create_user: 1
      });

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });
      sinon.stub(ArtifactService.prototype, 'updateArtifactsByUploadId').resolves([{ artifact_id: 'artifact-1' }]);
      sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId')
        .resolves([{ upload_archive_id: 'upload-archive-id' }]);

      const s3ClientStub = {
        send: sinon.stub().rejects(new Error('S3 API error: Access Denied'))
      };
      sinon.stub(fileUtils, 'getQuarantineS3Client').returns(s3ClientStub as any);
      sinon.stub(fileUtils, 'getQuarantineObjectStoreBucketName').returns('quarantine-bucket');

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('S3 API error');
      }
    });

    it('should throw if artifact update fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: 'upload-456',
        s3_upload_id: 's3-upload-111',
        status: UploadStatusEnum.PENDING,
        record_end_date: dayjs().add(30, 'minute').toISOString(),
        create_user: 1
      });

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });
      sinon
        .stub(ArtifactService.prototype, 'updateArtifactsByUploadId')
        .rejects(new Error('Database error: artifact update failed'));

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('artifact update failed');
      }
    });
  });
});
