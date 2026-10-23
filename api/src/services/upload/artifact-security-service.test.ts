import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import {
  ArtifactSecurity,
  CreateArtifactSecurity,
  StartedArtifactSecurityScan,
  UpdateArtifactSecurity
} from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { TicketArtifactService } from '../ticket-artifact-service';
import { ArtifactSecurityScanService } from './artifact-security-scan-service';
import { ArtifactSecurityService } from './artifact-security-service';
import { ScanOutcome } from './artifact-security-service.interface';
import { ArtifactService } from './artifact-service';
import { SubmissionUploadService } from './submission-upload-service';
import { UploadArchiveService } from './upload-archive-service';

chai.use(sinonChai);

describe('ArtifactSecurityService', () => {
  let mockDBConnection: IDBConnection;
  let service: ArtifactSecurityService;

  const mockSecurityRecord: ArtifactSecurity = {
    artifact_security_id: 'uuid-1',
    artifact_id: 'artifact-1',
    security: SecurityStatusEnum.CLEAN
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('should return a single security record', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.getArtifactSecurity('uuid-1');

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').rejects(new Error('DB Error'));

      try {
        await service.getArtifactSecurity('uuid-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactSecurity', () => {
    const fakeInput: CreateArtifactSecurity = {
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.CLEAN
    };

    it('should insert a new security record and return it', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.insertArtifactSecurity(fakeInput);

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity').rejects(new Error('Insert failed'));

      try {
        await service.insertArtifactSecurity(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('insertArtifactSecurityByUploadId', () => {
    const uploadId = 'upload-456';
    const fakeInput: Omit<CreateArtifactSecurity, 'artifact_id'> = {
      security: SecurityStatusEnum.PENDING
    };

    const mockSecurityRecords: ArtifactSecurity[] = [
      {
        artifact_security_id: 'uuid-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.PENDING
      },
      {
        artifact_security_id: 'uuid-2',
        artifact_id: 'artifact-2',
        security: SecurityStatusEnum.PENDING
      }
    ];

    it('should insert security records for all artifacts in upload and return them', async () => {
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId')
        .resolves(mockSecurityRecords);

      const result = await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);

      expect(result).to.eql(mockSecurityRecords);
      expect(result).to.have.lengthOf(2);
    });

    it('should return single record if only one artifact in upload', async () => {
      const singleRecord: ArtifactSecurity[] = [mockSecurityRecords[0]];
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId').resolves(singleRecord);

      const result = await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);

      expect(result).to.eql(singleRecord);
      expect(result).to.have.lengthOf(1);
    });

    it('should throw an error if repository fails', async () => {
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurityByUploadId')
        .rejects(new Error('Batch insert failed'));

      try {
        await service.insertArtifactSecurityByUploadId(uploadId, fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Batch insert failed');
      }
    });
  });

  describe('updateArtifactSecurity', () => {
    const fakeUpdate: UpdateArtifactSecurity = {
      security: SecurityStatusEnum.INFECTED
    };

    it('should update an existing security record and return it', async () => {
      const updatedRecord: ArtifactSecurity = {
        ...mockSecurityRecord,
        security: SecurityStatusEnum.INFECTED
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(updatedRecord);

      const result = await service.updateArtifactSecurity('uuid-1', fakeUpdate);

      expect(result).to.eql(updatedRecord);
      expect(result.security).to.equal(SecurityStatusEnum.INFECTED);
    });

    it('should allow updating to the same security value', async () => {
      const sameValueUpdate: UpdateArtifactSecurity = {
        security: SecurityStatusEnum.CLEAN
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.updateArtifactSecurity('uuid-1', sameValueUpdate);

      expect(result).to.eql(mockSecurityRecord);
    });

    it('should allow updating record_end_date', async () => {
      const endDate = '2025-12-31T23:59:59Z';
      const updateWithEndDate: UpdateArtifactSecurity = {
        record_end_date: endDate
      };
      const recordWithEndDate: ArtifactSecurity = {
        ...mockSecurityRecord,
        artifact_security_id: 'uuid-1'
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(recordWithEndDate);

      const result = await service.updateArtifactSecurity('uuid-1', updateWithEndDate);

      expect(result).to.eql(recordWithEndDate);
    });

    it('should allow updating artifact_id', async () => {
      const newArtifactId = 'artifact-new';
      const updateWithNewArtifact: UpdateArtifactSecurity = {
        artifact_id: newArtifactId
      };
      const recordWithNewArtifact: ArtifactSecurity = {
        ...mockSecurityRecord,
        artifact_id: newArtifactId
      };
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves(recordWithNewArtifact);

      const result = await service.updateArtifactSecurity('uuid-1', updateWithNewArtifact);

      expect(result).to.eql(recordWithNewArtifact);
      expect(result.artifact_id).to.equal(newArtifactId);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').rejects(new Error('Update failed'));

      try {
        await service.updateArtifactSecurity('uuid-1', fakeUpdate);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });

  describe('startArtifactSecurityScan', () => {
    const mockArtifact: Artifact = {
      artifact_id: 'artifact-1',
      artifact_status: ArtifactStatusEnum.UPLOADED,
      bucket: 'security-bucket',
      object_key: 'uploads/test.tar',
      byte_size: '1000',
      checksum_sha256: null,
      uploaded_at: '2024-01-01T00:00:00Z',
      format: 'tar'
    };

    const mockPendingSecurityRecord: ArtifactSecurity = {
      artifact_security_id: 'security-1',
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.PENDING
    };

    it('returns the existing result without a scan record when already processed (idempotent)', async () => {
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity')
        .resolves({ ...mockPendingSecurityRecord, security: SecurityStatusEnum.CLEAN });
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      const insertScanStub = sinon.stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan');

      const result = await service.startArtifactSecurityScan('security-1');

      expect(result).to.deep.equal({
        status: 'finished',
        result: { artifactId: 'artifact-1', objectKey: 'uploads/test.tar', securityStatus: SecurityStatusEnum.CLEAN }
      });
      expect(insertScanStub.called).to.be.false;
    });

    it('marks ERROR without a scan record when the artifact is not uploaded', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockPendingSecurityRecord);
      sinon
        .stub(ArtifactService.prototype, 'getArtifact')
        .resolves({ ...mockArtifact, artifact_status: ArtifactStatusEnum.PENDING });
      const updateSecurityStub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves({ ...mockPendingSecurityRecord, security: SecurityStatusEnum.ERROR });
      const insertScanStub = sinon.stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan');

      const result = await service.startArtifactSecurityScan('security-1');

      expect(result.status).to.equal('finished');
      expect(result.status === 'finished' && result.result.securityStatus).to.equal(SecurityStatusEnum.ERROR);
      expect(updateSecurityStub.calledOnceWith('security-1', { security: SecurityStatusEnum.ERROR })).to.be.true;
      expect(insertScanStub.called).to.be.false;
    });

    it('creates a PENDING scan record and returns the scan to run', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockPendingSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      const insertScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      const result = await service.startArtifactSecurityScan('security-1');

      expect(insertScanStub.firstCall.args[0]).to.deep.include({
        artifact_security_id: 'security-1',
        scan_status: ProcessStatusStatusEnum.PENDING
      });
      expect(result).to.deep.equal({
        status: 'started',
        scan: {
          artifactSecurityId: 'security-1',
          artifactSecurityScanId: 'scan-1',
          artifactId: 'artifact-1',
          bucket: 'security-bucket',
          objectKey: 'uploads/test.tar'
        }
      });
    });
  });

  describe('completeArtifactSecurityScan', () => {
    const startedScan: StartedArtifactSecurityScan = {
      artifactSecurityId: 'security-1',
      artifactSecurityScanId: 'scan-1',
      artifactId: 'artifact-1',
      bucket: 'security-bucket',
      objectKey: 'uploads/test.tar'
    };

    const mockUploadArchive: UploadArchive = {
      upload_archive_id: 'archive-1',
      upload_id: 'upload-1',
      artifact_id: 'artifact-1',
      archive_status: ProcessStatusStatusEnum.BLOCKED
    };

    const mockSubmissionUpload = {
      submission_upload_id: 'su-1',
      submission_id: 123,
      upload_id: 'upload-1',
      status: 'uploaded' as const,
      ticket_id: '11111111-1111-1111-1111-111111111111'
    };

    const createOutcome = (securityStatus: SecurityStatusEnum): ScanOutcome => ({
      scanStatus: ProcessStatusStatusEnum.COMPLETED,
      securityStatus,
      scannedAt: '2024-01-01T00:00:00Z',
      scannerVersion: null,
      results: { isInfected: securityStatus === SecurityStatusEnum.INFECTED, viruses: [], timeout: false }
    });

    let lockStub: sinon.SinonStub;

    beforeEach(() => {
      process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
      lockStub = sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurityWithLock').resolves({
        artifact_security_id: 'security-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.PENDING
      });
    });

    it('keeps the first applied result when another attempt already finished the scan', async () => {
      lockStub.resolves({
        artifact_security_id: 'security-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.INFECTED
      });
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateSecurityStub = sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity');
      const publishStub = sinon.stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob');
      const promoteStub = sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity');

      const result = await service.completeArtifactSecurityScan(startedScan, createOutcome(SecurityStatusEnum.CLEAN));

      expect(lockStub).to.have.been.calledOnceWith('security-1');
      expect(updateScanStub).to.have.been.calledOnce;
      expect(updateSecurityStub).not.to.have.been.called;
      expect(publishStub).not.to.have.been.called;
      expect(promoteStub).not.to.have.been.called;
      expect(result.securityStatus).to.equal(SecurityStatusEnum.INFECTED);
    });

    it('records the scan and writes INFECTED without publishing or promoting', async () => {
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateSecurityStub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .callsFake(async (id, data) => ({
          artifact_security_id: id,
          artifact_id: 'artifact-1',
          security: data.security as SecurityStatusEnum
        }));
      const publishStub = sinon.stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob');
      const promoteStub = sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity');

      const result = await service.completeArtifactSecurityScan(
        startedScan,
        createOutcome(SecurityStatusEnum.INFECTED)
      );

      expect(result.securityStatus).to.equal(SecurityStatusEnum.INFECTED);
      expect(updateScanStub.firstCall.args[1].scan_status).to.equal(ProcessStatusStatusEnum.COMPLETED);
      expect(updateSecurityStub.calledOnceWith('security-1', { security: SecurityStatusEnum.INFECTED })).to.be.true;
      expect(publishStub.called).to.be.false;
      expect(promoteStub.called).to.be.false;
    });

    it('publishes downstream processing before writing CLEAN and promoting a clean archive', async () => {
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateSecurityStub = sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves({
        artifact_security_id: 'security-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      });
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves(mockSubmissionUpload);
      const publishStub = sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'uploads/test.tar' });
      sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({ artifact_id: 'artifact-1' });
      const updateArchiveStub = sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchive')
        .resolves({ upload_archive_id: 'archive-1' });

      await service.completeArtifactSecurityScan(startedScan, createOutcome(SecurityStatusEnum.CLEAN));

      expect(publishStub.firstCall.args[1]).to.deep.equal(mockSubmissionUpload);
      expect(publishStub.calledBefore(updateSecurityStub)).to.be.true;
      expect(updateSecurityStub.calledOnceWith('security-1', { security: SecurityStatusEnum.CLEAN })).to.be.true;
      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(updateArchiveStub.calledOnceWith('archive-1', { archive_status: ProcessStatusStatusEnum.PENDING })).to.be
        .true;
    });

    it('keeps ticket artifact stable while promoting a clean ticket attachment', async () => {
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').resolves({
        artifact_security_id: 'security-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      });
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(null);
      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'uploads/test.tar' });
      const updateArtifactStub = sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({
        artifact_id: 'artifact-1'
      });
      const insertTicketArtifactsStub = sinon
        .stub(TicketArtifactService.prototype, 'insertTicketArtifacts')
        .resolves([]);
      const publishStub = sinon.stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob');

      await service.completeArtifactSecurityScan(startedScan, createOutcome(SecurityStatusEnum.CLEAN));

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(updateArtifactStub.calledOnceWith('artifact-1', { bucket: 'main-bucket' })).to.be.true;
      expect(insertTicketArtifactsStub.called).to.be.false;
      expect(publishStub.called).to.be.false;
    });

    it('does not write CLEAN, unblock the archive, or promote S3 when clean-scan publish throws', async () => {
      // Publish must run BEFORE the CLEAN security write, the archive unblock, and the S3 promote,
      // so a queue outage leaves the security record PENDING for the retried scan.
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves(mockSubmissionUpload);
      sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .rejects(new Error('pg-boss unavailable'));
      const updateSecurityStub = sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity');
      const promoteStub = sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity');
      const updateArchiveStub = sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive');

      try {
        await service.completeArtifactSecurityScan(startedScan, createOutcome(SecurityStatusEnum.CLEAN));
        expect.fail('expected completeArtifactSecurityScan to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }

      expect(updateSecurityStub.called).to.be.false;
      expect(promoteStub.called).to.be.false;
      expect(updateArchiveStub.called).to.be.false;
    });
  });

  describe('failArtifactSecurityScan', () => {
    it('marks the scan record FAILED with the error message', async () => {
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      await service.failArtifactSecurityScan('scan-1', new Error('ClamAV connection failed'));

      expect(updateScanStub.firstCall.args[0]).to.equal('scan-1');
      expect(updateScanStub.firstCall.args[1].scan_status).to.equal(ProcessStatusStatusEnum.FAILED);
      expect(updateScanStub.firstCall.args[1].results).to.deep.equal({ error: 'ClamAV connection failed' });
    });

    it('strips null bytes from failed scan error results', async () => {
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      await service.failArtifactSecurityScan('scan-1', new Error('INSTREAM size limit exceeded. ERROR\u0000'));

      expect(updateScanStub.firstCall.args[1].results).to.deep.equal({ error: 'INSTREAM size limit exceeded. ERROR' });
    });
  });

  describe('handleCleanScanResult', () => {
    const mockUploadArchive: UploadArchive = {
      upload_archive_id: 'archive-1',
      upload_id: 'upload-1',
      artifact_id: 'artifact-1',
      archive_status: ProcessStatusStatusEnum.BLOCKED
    };

    beforeEach(() => {
      process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
    });

    it('should promote file and unblock archive', async () => {
      // Verifies: handleCleanScanResult promotes file and updates archive status.
      // Caller is responsible for looking up the archive; this method receives it pre-resolved.

      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      const updateArchiveStub = sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({
        upload_archive_id: 'archive-1'
      });

      const updateArtifactStub = sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({
        artifact_id: 'artifact-1'
      });

      await service.handleCleanScanResult(mockUploadArchive, 'artifact-1', 'uploads/test.tar');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(updateArtifactStub.calledOnceWith('artifact-1', { bucket: 'main-bucket' })).to.be.true;
      expect(updateArchiveStub.calledOnceWith('archive-1', { archive_status: ProcessStatusStatusEnum.PENDING })).to.be
        .true;
    });

    it('should still promote file when upload_archive is missing', async () => {
      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      const updateArtifactStub = sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({
        artifact_id: 'artifact-1'
      });
      const updateArchiveStub = sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive');

      await service.handleCleanScanResult(null, 'artifact-1', 'uploads/test.tar');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(updateArtifactStub.calledOnceWith('artifact-1', { bucket: 'main-bucket' })).to.be.true;
      expect(updateArchiveStub.called).to.be.false;
    });
  });

  describe('publishNextPipelineStep', () => {
    const mockUploadArchive: UploadArchive = {
      upload_archive_id: 'archive-1',
      upload_id: 'upload-1',
      artifact_id: 'artifact-1',
      archive_status: ProcessStatusStatusEnum.PENDING
    };

    it('should publish process-submission-features job with correct submissionId', async () => {
      // Verifies: looks up submission via upload_id and publishes with correct submissionId

      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 999,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '22222222-2222-2222-2222-222222222222'
      });
      const publishStub = sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.publishNextPipelineStep(mockUploadArchive);

      expect(publishStub.calledOnce).to.be.true;
      // Publisher now receives the full SubmissionUpload record
      expect(publishStub.firstCall.args[1]).to.deep.equal({
        submission_upload_id: 'su-1',
        submission_id: 999,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '22222222-2222-2222-2222-222222222222'
      });
    });

    it('should propagate error when submission_upload lookup throws', async () => {
      // Verifies: missing submission_upload is data corruption — error propagates

      sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId')
        .rejects(new Error('Failed to get submission upload record'));

      try {
        await service.publishNextPipelineStep(mockUploadArchive);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to get submission upload record');
      }
    });

    it('throws when publishProcessSubmissionFeaturesJob throws', async () => {
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 999,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '22222222-2222-2222-2222-222222222222'
      });
      sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .rejects(new Error('pg-boss unavailable'));

      try {
        await service.publishNextPipelineStep(mockUploadArchive);
        expect.fail('expected publishNextPipelineStep to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
      }
    });
  });

  describe('failSubmissionUploadByArtifactSecurityId', () => {
    const mockUploadArchive: UploadArchive = {
      upload_archive_id: 'archive-1',
      upload_id: 'upload-1',
      artifact_id: 'artifact-1',
      archive_status: ProcessStatusStatusEnum.PENDING
    };

    const mockSubmissionUpload = {
      submission_upload_id: 'su-1',
      submission_id: 999,
      upload_id: 'upload-1',
      status: 'uploaded' as const,
      ticket_id: '22222222-2222-2222-2222-222222222222'
    };

    it('transitions the owning submission upload to failed', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves(mockSubmissionUpload);
      const transitionStub = sinon
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToFailed')
        .resolves();

      await service.failSubmissionUploadByArtifactSecurityId('uuid-1');

      expect(transitionStub).to.have.been.calledOnceWith('su-1');
    });

    it('is a no-op when the artifact has no upload_archive', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(null);
      const getSubmissionUploadStub = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId');
      const transitionStub = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToFailed');

      await service.failSubmissionUploadByArtifactSecurityId('uuid-1');

      expect(getSubmissionUploadStub).to.not.have.been.called;
      expect(transitionStub).to.not.have.been.called;
    });

    it('is a no-op when the upload has already reached a terminal status', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon
        .stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId')
        .resolves({ ...mockSubmissionUpload, status: 'indexed' });
      const transitionStub = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToFailed');

      await service.failSubmissionUploadByArtifactSecurityId('uuid-1');

      expect(transitionStub).to.not.have.been.called;
    });

    it('propagates errors from the upload_archive lookup', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon
        .stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId')
        .rejects(new Error('DB connection lost'));

      try {
        await service.failSubmissionUploadByArtifactSecurityId('uuid-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB connection lost');
      }
    });
  });
});
