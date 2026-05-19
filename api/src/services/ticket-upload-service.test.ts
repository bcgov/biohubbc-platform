import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { HTTP400, HTTP401, HTTP409 } from '../errors/http-error';
import { Artifact, ArtifactStatusEnum } from '../models/artifact';
import { ArtifactSecurity, CreateArtifactSecurity } from '../models/artifact-security';
import { SecurityStatusEnum } from '../models/security-status';
import { TicketArtifact } from '../models/ticket-artifact';
import { UploadStatusEnum } from '../models/upload';
import { UploadArtifactRoleEnum } from '../models/upload-artifact';
import { TicketArtifactService } from './ticket-artifact-service';
import { TicketUploadService } from './ticket-upload-service';
import { ArtifactSecurityService } from './upload/artifact-security-service';
import { ArtifactService } from './upload/artifact-service';
import { UploadArtifactService } from './upload/upload-artifact-service';
import { UploadService } from './upload/upload-service';

chai.use(sinonChai);

describe('TicketUploadService', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const uploadId = '22222222-2222-2222-2222-222222222222';
  const artifactId = '33333333-3333-3333-3333-333333333333';

  afterEach(() => {
    sinon.restore();
  });

  describe('initializeTicketUpload', () => {
    it('preserves the uploaded file name at the end of the artifact object key', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketUploadService(mockDBConnection);
      const objectKey = `tickets/${ticketId}/upload/${uploadId}/generate.py`;

      const insertUploadStub = sinon.stub(UploadService.prototype, 'insertUpload').resolves({ upload_id: uploadId });
      const insertArtifactStub = sinon.stub(ArtifactService.prototype, 'insertArtifact').resolves({
        artifact_id: artifactId,
        artifact_status: ArtifactStatusEnum.PENDING,
        bucket: 'ticket-bucket',
        object_key: objectKey,
        byte_size: '128',
        checksum_sha256: null,
        uploaded_at: null,
        format: 'py'
      });
      const insertUploadArtifactsStub = sinon
        .stub(UploadArtifactService.prototype, 'insertUploadArtifacts')
        .resolves([{ upload_artifact_id: '55555555-5555-5555-8555-555555555555' }]);
      sinon.stub(TicketUploadService.dependencies, 'getQuarantineBucketName').returns('ticket-bucket');
      const getPresignedUploadUrlStub = sinon
        .stub(TicketUploadService.dependencies, 'getPresignedUploadUrl')
        .resolves('https://example.com/presigned');

      const result = await service.initializeTicketUpload(ticketId, {
        file_name: 'nested\\generate.py',
        byte_size: 128,
        content_type: 'text/x-python'
      });

      expect(insertUploadStub).to.have.been.calledOnceWith(
        sinon.match({
          upload_status: UploadStatusEnum.PENDING,
          s3_upload_id: null
        })
      );
      expect(insertArtifactStub).to.have.been.calledOnceWith({
        artifact_status: ArtifactStatusEnum.PENDING,
        bucket: 'ticket-bucket',
        object_key: objectKey,
        byte_size: 128,
        checksum_sha256: null,
        uploaded_at: null,
        format: 'py'
      });
      expect(insertUploadArtifactsStub).to.have.been.calledOnceWith([
        {
          upload_id: uploadId,
          artifact_id: artifactId,
          role: UploadArtifactRoleEnum.ATTACHMENT,
          upload_archive_id: null,
          path: null
        }
      ]);
      expect(getPresignedUploadUrlStub).to.have.been.calledOnce;
      expect(getPresignedUploadUrlStub.firstCall.args[0].input).to.include({
        Bucket: 'ticket-bucket',
        Key: objectKey,
        ContentType: 'text/x-python'
      });
      expect(result).to.eql({
        upload_id: uploadId,
        presigned_upload_url: 'https://example.com/presigned'
      });
    });
  });

  describe('completeTicketUpload', () => {
    it('marks the quarantine artifact uploaded and publishes a malware scan job', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 7
      });
      const service = new TicketUploadService(mockDBConnection);
      const objectKey = `tickets/${ticketId}/upload/${uploadId}/generate.py`;
      const ticketArtifact: TicketArtifact = {
        ticket_artifact_id: '55555555-5555-4555-8555-555555555555',
        ticket_id: ticketId,
        artifact_id: artifactId,
        record_end_date: null,
        create_date: '2026-04-29T00:00:00.000Z',
        key: objectKey
      };

      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: uploadId,
        upload_status: UploadStatusEnum.PENDING,
        record_end_date: new Date(Date.now() + 60_000).toISOString(),
        s3_upload_id: null,
        create_user: 7
      });
      const updateUploadStub = sinon.stub(UploadService.prototype, 'updateUpload').resolves({ upload_id: uploadId });
      const getArtifactsByUploadIdStub = sinon
        .stub(UploadArtifactService.prototype, 'getArtifactsByUploadId')
        .resolves([
          {
            artifact_id: artifactId,
            artifact_status: ArtifactStatusEnum.PENDING,
            bucket: 'quarantine-bucket',
            object_key: objectKey,
            byte_size: '128',
            checksum_sha256: null,
            uploaded_at: null,
            format: 'py'
          } satisfies Artifact
        ]);
      const updateArtifactStub = sinon
        .stub(ArtifactService.prototype, 'updateArtifact')
        .resolves({ artifact_id: artifactId });
      const insertTicketArtifactsStub = sinon
        .stub(TicketArtifactService.prototype, 'insertTicketArtifacts')
        .resolves([ticketArtifact]);
      const insertedSecurity: ArtifactSecurity = {
        artifact_security_id: '44444444-4444-4444-8444-444444444444',
        artifact_id: artifactId,
        security: SecurityStatusEnum.PENDING
      };
      const insertSecurityStub = sinon
        .stub(ArtifactSecurityService.prototype, 'insertArtifactSecurity')
        .resolves(insertedSecurity);
      const publishScanStub = sinon
        .stub(TicketUploadService.dependencies, 'publishMalwareScanJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.completeTicketUpload(ticketId, uploadId, { status: 'uploaded' });

      expect(getArtifactsByUploadIdStub).to.have.been.calledOnceWith(uploadId, UploadArtifactRoleEnum.ATTACHMENT);
      expect(updateUploadStub).to.have.been.calledOnceWith(uploadId, {
        upload_status: UploadStatusEnum.COMPLETED
      });
      expect(updateArtifactStub).to.have.been.calledOnceWith(
        artifactId,
        sinon.match({
          artifact_status: ArtifactStatusEnum.UPLOADED
        })
      );
      expect(insertTicketArtifactsStub).to.have.been.calledOnceWith(ticketId, [artifactId]);
      expect(insertSecurityStub).to.have.been.calledOnceWith({
        artifact_id: artifactId,
        security: SecurityStatusEnum.PENDING
      } satisfies CreateArtifactSecurity);
      expect(publishScanStub).to.have.been.calledOnceWith(mockDBConnection, {
        artifactSecurityId: '44444444-4444-4444-8444-444444444444'
      });
      expect(result).to.eql(ticketArtifact);
    });

    it('rejects invalid completion status before mutating the upload', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 7
      });
      const service = new TicketUploadService(mockDBConnection);
      const getUploadStub = sinon.stub(UploadService.prototype, 'getUpload');

      try {
        await service.completeTicketUpload(ticketId, uploadId, { status: 'failed' } as any);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as Error).message).to.equal('Invalid upload completion status');
        expect(getUploadStub.called).to.be.false;
      }
    });

    it('rejects completion when no attachment artifact is linked to the upload', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 7
      });
      const service = new TicketUploadService(mockDBConnection);

      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: uploadId,
        upload_status: UploadStatusEnum.PENDING,
        record_end_date: new Date(Date.now() + 60_000).toISOString(),
        s3_upload_id: null,
        create_user: 7
      });
      sinon.stub(UploadArtifactService.prototype, 'getArtifactsByUploadId').resolves([]);

      try {
        await service.completeTicketUpload(ticketId, uploadId, { status: 'uploaded' });
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP401);
      }
    });

    it('rejects completion when multiple attachment artifacts are linked to one direct upload', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 7
      });
      const service = new TicketUploadService(mockDBConnection);
      const objectKey = `tickets/${ticketId}/upload/${uploadId}/generate.py`;

      sinon.stub(UploadService.prototype, 'getUpload').resolves({
        upload_id: uploadId,
        upload_status: UploadStatusEnum.PENDING,
        record_end_date: new Date(Date.now() + 60_000).toISOString(),
        s3_upload_id: null,
        create_user: 7
      });
      sinon.stub(UploadArtifactService.prototype, 'getArtifactsByUploadId').resolves([
        {
          artifact_id: artifactId,
          artifact_status: ArtifactStatusEnum.PENDING,
          bucket: 'quarantine-bucket',
          object_key: objectKey,
          byte_size: '128',
          checksum_sha256: null,
          uploaded_at: null,
          format: 'py'
        },
        {
          artifact_id: '66666666-6666-6666-8666-666666666666',
          artifact_status: ArtifactStatusEnum.PENDING,
          bucket: 'quarantine-bucket',
          object_key: `tickets/${ticketId}/upload/${uploadId}/other.py`,
          byte_size: '256',
          checksum_sha256: null,
          uploaded_at: null,
          format: 'py'
        }
      ]);

      try {
        await service.completeTicketUpload(ticketId, uploadId, { status: 'uploaded' });
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as Error).message).to.equal('Upload has unexpected attachment artifacts');
      }
    });
  });
});
