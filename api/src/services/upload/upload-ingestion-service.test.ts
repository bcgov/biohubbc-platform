import { S3Client } from '@aws-sdk/client-s3';
import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { v4 } from 'uuid';
import { IDBConnection } from '../../database/db';
import { HTTP401 } from '../../errors/http-error';
import { ArtifactSecurity } from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { SubmissionUploadReviewStatus } from '../../models/submission-upload-review-status';
import { Upload, UploadStatusEnum } from '../../models/upload';
import { UploadArchive } from '../../models/upload-archive';
import * as publisher from '../../queue/publisher';
import { ICreateSubmission, ISubmissionModel } from '../../repositories/submission-repository';
import * as fileUtils from '../../utils/file-utils';
import * as submissionUploadUtils from '../../utils/submission-upload-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionService } from '../submission-service';
import { TicketService } from '../ticket-service';
import { ArtifactSecurityService } from './artifact-security-service';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';
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
    contributor_id: 1,
    name: 'Test Submission',
    description: 'Test Description',
    comment: 'Test Comment'
  };

  beforeEach(() => {
    mockConnection = getMockDBConnection({ systemUserId: () => 1 });
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
      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        uuid: mockSubmission.uuid
      } as ISubmissionModel);
      sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: mockUploadId });
      const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: '11111111-1111-1111-1111-111111111111'
      } as any);
      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'insertSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: 'submission-upload-id-1',
        status: 'submitted'
      } as SubmissionUploadReviewStatus);
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: mockArtifactId });
      sinon
        .stub(UploadArchiveService.prototype, 'insertUploadArchive')
        .resolves({ upload_archive_id: mockUploadArchiveId });

      const mockPresigned = {
        uploadId: mockS3UploadId,
        presignedUrls: [
          { partNumber: 1, url: 'https://s3-url-1', partSizeBytes: 5_000_000 },
          { partNumber: 2, url: 'https://s3-url-2', partSizeBytes: 100_000 }
        ],
        partCount: 2
      };
      sinon.stub(submissionUploadUtils, 'generateMultipartUploadPresignedUrls').resolves(mockPresigned);

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: mockUploadId });

      const result = await service.startArchiveUpload(mockBytes, mockSubmission);

      expect(createTicketStub).to.have.been.calledWith(
        sinon.match({
          subject: 'New Submission',
          priority: 'medium',
          description: `Submission ID: ${mockSubmissionId}. Submission UUID: ${mockSubmission.uuid}. Upload UUID: ${mockUploadId}`
        }),
        [mockSubmission.system_user_id]
      );
      expect(result.submissionId).to.equal(mockSubmission.uuid);
      expect(result.uploadId).to.equal(mockUploadId);
      expect(result.uploadArchiveId).to.equal(mockUploadArchiveId);
      expect(result.s3UploadId).to.equal(mockS3UploadId);
      expect(result.partCount).to.equal(mockPresigned.partCount);
      expect(result.presignedUrls).to.deep.equal(mockPresigned.presignedUrls);
      expect(result.presignedUrls[0].partSizeBytes).to.equal(mockPresigned.presignedUrls[0].partSizeBytes);
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
      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        uuid: mockSubmission.uuid
      } as ISubmissionModel);
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
      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        uuid: mockSubmission.uuid
      } as ISubmissionModel);
      sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: 'upload-456' });
      sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: '11111111-1111-1111-1111-111111111111'
      } as any);
      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'insertSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: 'submission-upload-id-1',
        status: 'submitted'
      } as SubmissionUploadReviewStatus);
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
      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        uuid: mockSubmission.uuid
      } as ISubmissionModel);
      sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: 'upload-456' });
      sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: '11111111-1111-1111-1111-111111111111'
      } as any);
      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-id-1' });
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'insertSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: 'submission-upload-id-1',
        status: 'submitted'
      } as SubmissionUploadReviewStatus);
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: 'artifact-789' });
      sinon
        .stub(UploadArchiveService.prototype, 'insertUploadArchive')
        .resolves({ upload_archive_id: 'upload-archive-999' });
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

  describe('startArchiveUploadForExistingSubmissionByUuid', () => {
    it('should pass submission owner system user ids to createTicket', async () => {
      const submissionUuid = mockSubmission.uuid;
      const existingSubmissionId = 456;
      const ownerSystemUserId = 99;
      const mockUploadId = 'upload-append-1';
      const mockArtifactId = 'artifact-append-1';
      const mockUploadArchiveId = 'upload-archive-append-1';
      const mockS3UploadId = 's3-append-1';
      const mockBytes = 3_000_000;

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionIdByUUID')
        .resolves({ submission_id: existingSubmissionId });
      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        uuid: submissionUuid,
        system_user_id: ownerSystemUserId
      } as ISubmissionModel);
      sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: mockUploadId });
      const createTicketStub = sinon.stub(TicketService.prototype, 'createTicket').resolves({
        ticket_id: '22222222-2222-2222-2222-222222222222'
      } as any);
      sinon
        .stub(SubmissionUploadService.prototype, 'insertSubmissionUpload')
        .resolves({ submission_upload_id: 'submission-upload-append-1' });
      sinon.stub(SubmissionUploadReviewStatusService.prototype, 'insertSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: 'submission-upload-append-1',
        status: 'submitted'
      } as SubmissionUploadReviewStatus);
      sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({ artifact_id: mockArtifactId });
      sinon
        .stub(UploadArchiveService.prototype, 'insertUploadArchive')
        .resolves({ upload_archive_id: mockUploadArchiveId });
      sinon.stub(submissionUploadUtils, 'generateMultipartUploadPresignedUrls').resolves({
        uploadId: mockS3UploadId,
        presignedUrls: [{ partNumber: 1, url: 'https://s3-url-append', partSizeBytes: mockBytes }],
        partCount: 1
      });
      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: mockUploadId });

      const result = await service.startArchiveUploadForExistingSubmissionByUuid(mockBytes, submissionUuid);

      expect(createTicketStub).to.have.been.calledWith(
        sinon.match({
          subject: 'New Submission',
          priority: 'medium',
          description: `Submission ID: ${existingSubmissionId}. Submission UUID: ${submissionUuid}. Upload UUID: ${mockUploadId}`
        }),
        [ownerSystemUserId]
      );
      expect(result.submissionId).to.equal(submissionUuid);
      expect(result.uploadId).to.equal(mockUploadId);
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

    const mockUpload: Upload = {
      upload_id: 'upload-456',
      s3_upload_id: 's3-upload-111',
      upload_status: UploadStatusEnum.PENDING,
      record_end_date: dayjs().add(30, 'minute').toISOString(),
      create_user: 1
    };

    const mockSecurityRecords: ArtifactSecurity[] = [
      {
        artifact_security_id: 'artifact-security-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.PENDING
      },
      {
        artifact_security_id: 'artifact-security-2',
        artifact_id: 'artifact-2',
        security: SecurityStatusEnum.PENDING
      }
    ];

    const mockUploadArchiveRecords: UploadArchive[] = [
      {
        upload_archive_id: 'upload-archive-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED,
        artifact_id: 'artifact-1',
        upload_id: 'upload-456'
      },
      {
        upload_archive_id: 'upload-archive-2',
        archive_status: ProcessStatusStatusEnum.BLOCKED,
        artifact_id: 'artifact-2',
        upload_id: 'upload-456'
      }
    ];

    beforeEach(() => {
      sinon.stub(publisher, 'publishMalwareScanJob').resolves({ status: 'published', jobId: 'job-1' });
    });

    it('should complete upload successfully and enqueue security artifacts', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });

      sinon.stub(ArtifactService.prototype, 'updateArtifactsByUploadId').resolves();

      sinon.stub(ArtifactSecurityService.prototype, 'insertArtifactSecurityByUploadId').resolves(mockSecurityRecords);

      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId').resolves(mockUploadArchiveRecords);

      const s3ClientStub = { send: sinon.stub().resolves({ ETag: 'etag' }) };
      sinon.stub(fileUtils, 'getSecurityS3Client').returns(s3ClientStub as unknown as S3Client);
      sinon.stub(fileUtils, 'getSecurityObjectStoreBucketName').returns('security-bucket');

      await service.completeArchiveUpload(mockParams);

      const publishStub = publisher.publishMalwareScanJob as sinon.SinonStub;
      expect(publishStub.callCount).to.equal(mockSecurityRecords.length);
      expect(publishStub.firstCall.args[1]).to.deep.equal({ artifactSecurityId: 'artifact-security-1' });
      expect(publishStub.secondCall.args[1]).to.deep.equal({ artifactSecurityId: 'artifact-security-2' });
      expect(s3ClientStub.send).to.have.been.calledOnce;
    });

    it('should throw HTTP401 if upload s3_upload_id does not match', async () => {
      const invalidUpload = {
        ...mockUpload,
        s3_upload_id: 'wrong-s3-id'
      };
      sinon.stub(UploadService.prototype, 'getUpload').resolves(invalidUpload);

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload creator does not match current user', async () => {
      const invalidUpload = {
        ...mockUpload,
        create_user: 999
      };
      sinon.stub(UploadService.prototype, 'getUpload').resolves(invalidUpload);

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload is not in PENDING status', async () => {
      const invalidUpload = {
        ...mockUpload,
        upload_status: UploadStatusEnum.COMPLETED
      };
      sinon.stub(UploadService.prototype, 'getUpload').resolves(invalidUpload);

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw HTTP401 if upload record_end_date has passed', async () => {
      const expiredUpload = {
        ...mockUpload,
        record_end_date: dayjs().subtract(5, 'minute').toISOString()
      };
      sinon.stub(UploadService.prototype, 'getUpload').resolves(expiredUpload);

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected HTTP401 error not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(HTTP401);
        expect((err as HTTP401).message).to.equal('Access Denied');
      }
    });

    it('should throw if upload status update fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

      sinon.stub(UploadService.prototype, 'updateUpload').rejects(new Error('Database error: upload update failed'));

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('upload update failed');
      }
    });

    it('should throw if artifact status update fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

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

    it('should throw if artifact security insert fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });

      sinon.stub(ArtifactService.prototype, 'updateArtifactsByUploadId').resolves();

      sinon
        .stub(ArtifactSecurityService.prototype, 'insertArtifactSecurityByUploadId')
        .rejects(new Error('Database error: artifact security insert failed'));

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('artifact security insert failed');
      }
    });

    it('should throw if upload archive update fails', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });

      sinon.stub(ArtifactService.prototype, 'updateArtifactsByUploadId').resolves();

      sinon.stub(ArtifactSecurityService.prototype, 'insertArtifactSecurityByUploadId').resolves();

      sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId')
        .rejects(new Error('Database error: update upload archive failed'));

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('update upload archive failed');
      }
    });

    it('should throw if S3 multipart completion fails and should NOT publish malware jobs', async () => {
      sinon.stub(UploadService.prototype, 'getUpload').resolves(mockUpload);

      sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: 'upload-456' });

      sinon.stub(ArtifactService.prototype, 'updateArtifactsByUploadId').resolves();

      sinon.stub(ArtifactSecurityService.prototype, 'insertArtifactSecurityByUploadId').resolves(mockSecurityRecords);

      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchivesByUploadId').resolves(mockUploadArchiveRecords);

      const fakeS3Client: Pick<S3Client, 'send'> = {
        send: sinon.stub().rejects(new Error('S3 API error: Access Denied'))
      };

      sinon.stub(fileUtils, 'getSecurityS3Client').returns(fakeS3Client as S3Client);
      sinon.stub(fileUtils, 'getSecurityObjectStoreBucketName').returns('security-bucket');

      try {
        await service.completeArchiveUpload(mockParams);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.include('S3 API error');

        // Verify no malware jobs were published since S3 failed before job publishing
        const publishStub = publisher.publishMalwareScanJob as sinon.SinonStub;
        expect(publishStub.called).to.be.false;
      }
    });
  });
});
