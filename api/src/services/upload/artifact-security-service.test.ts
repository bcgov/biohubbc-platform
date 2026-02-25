import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Readable } from 'stream';
import { IDBConnection } from '../../database/db';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import * as publisher from '../../queue/publisher';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import * as fileUtils from '../../utils/file-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactSecurityScanService } from './artifact-security-scan-service';
import { ArtifactSecurityService } from './artifact-security-service';
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
    const fakeInput = {
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
      const singleRecord = [mockSecurityRecords[0]];
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

  describe('executeScan', () => {
    const mockArtifact: Artifact = {
      artifact_id: 'artifact-1',
      artifact_status: ArtifactStatusEnum.UPLOADED,
      bucket: 'security-bucket',
      object_key: 'uploads/test.tar',
      byte_size: '1000',
      checksum_sha256: null,
      uploaded_at: '2024-01-01T00:00:00Z'
    };

    const mockSecurityRecord: ArtifactSecurity = {
      artifact_security_id: 'security-1',
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.PENDING
    };

    beforeEach(() => {
      process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME = 'security-bucket';
      process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
    });

    it('should return early if already processed (idempotent)', async () => {
      const processedRecord: ArtifactSecurity = {
        ...mockSecurityRecord,
        security: SecurityStatusEnum.CLEAN
      };

      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(processedRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      const insertScanStub = sinon.stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan');

      const result = await service.executeScan('security-1');

      expect(result.securityStatus).to.equal(SecurityStatusEnum.CLEAN);
      expect(insertScanStub.called).to.be.false;
    });

    it('should return ERROR if artifact is not uploaded', async () => {
      const pendingArtifact: Artifact = {
        ...mockArtifact,
        artifact_status: ArtifactStatusEnum.PENDING
      };

      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(pendingArtifact);
      const updateSecurityStub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves({ ...mockSecurityRecord, security: SecurityStatusEnum.ERROR });

      const result = await service.executeScan('security-1');

      expect(result.securityStatus).to.equal(SecurityStatusEnum.ERROR);
      expect(updateSecurityStub.calledOnceWith('security-1', { security: SecurityStatusEnum.ERROR })).to.be.true;
    });

    it('should create scan record and run scan successfully', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      const insertScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves({ ...mockSecurityRecord, security: SecurityStatusEnum.INFECTED });

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));
      sinon.stub(fileUtils, '_getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: true, viruses: ['TestVirus'] })
      } as any);

      const result = await service.executeScan('security-1');

      expect(result.securityStatus).to.equal(SecurityStatusEnum.INFECTED);
      expect(insertScanStub.calledOnce).to.be.true;
      expect(updateScanStub.calledOnce).to.be.true;
      expect(updateScanStub.firstCall.args[1].scan_status).to.equal(ProcessStatusStatusEnum.COMPLETED);
    });

    it('should update security status to INFECTED when ClamAV detects malware', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      // Use callsFake to capture what the code passes, rather than pre-determining the result
      const updateSecurityStub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .callsFake(async (id, data) => ({
          artifact_security_id: id,
          artifact_id: mockArtifact.artifact_id,
          security: data.security as SecurityStatusEnum
        }));

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));

      // KEY INPUT: ClamAV says infected
      sinon.stub(fileUtils, '_getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: true, viruses: ['TestVirus'] })
      } as any);

      const result = await service.executeScan('security-1');

      // Verify the DECISION: code should pass INFECTED to updateArtifactSecurity
      expect(updateSecurityStub.calledOnce).to.be.true;
      expect(updateSecurityStub.firstCall.args[1]).to.deep.equal({
        security: SecurityStatusEnum.INFECTED
      });

      // Verify the result reflects the decision
      expect(result.securityStatus).to.equal(SecurityStatusEnum.INFECTED);
    });

    it('should call handleCleanScanResult on clean scan', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves({ ...mockSecurityRecord, security: SecurityStatusEnum.CLEAN });

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));
      sinon.stub(fileUtils, '_getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: false })
      } as any);

      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(null);

      await service.executeScan('security-1');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
    });

    it('should update scan record to FAILED on error and rethrow', async () => {
      const testError = new Error('ClamAV connection failed');

      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));
      sinon.stub(fileUtils, '_getClamAvScanner').rejects(testError);

      try {
        await service.executeScan('security-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.equal(testError);
        expect(updateScanStub.calledWith('scan-1', sinon.match({ scan_status: ProcessStatusStatusEnum.FAILED }))).to.be
          .true;
        expect(updateScanStub.lastCall.args[1].results).to.deep.include({ error: 'ClamAV connection failed' });
      }
    });
  });

  describe('handleCleanScanResult', () => {
    it('should promote file from security bucket to main bucket', async () => {
      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(null);

      await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
    });

    it('should update upload_archive status to PENDING if archive exists', async () => {
      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };
      sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity').resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(mockUploadArchive);
      const updateArchiveStub = sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({
        upload_archive_id: 'archive-1'
      });
      sinon.stub(SubmissionUploadService.prototype, 'findSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 123,
        upload_id: 'upload-1'
      });
      sinon.stub(publisher, 'publishProcessSubmissionFeaturesJob').resolves({ status: 'published', jobId: 'job-1' });

      await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');

      expect(updateArchiveStub.calledOnceWith('archive-1', { archive_status: ProcessStatusStatusEnum.PENDING })).to.be
        .true;
    });

    it('should handle missing upload_archive gracefully', async () => {
      sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity').resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(null);
      const updateArchiveStub = sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive');
      const publishStub = sinon
        .stub(publisher, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');

      expect(updateArchiveStub.called).to.be.false;
      expect(publishStub.called).to.be.false;
    });

    it('should publish process-submission-features job with correct submissionId', async () => {
      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };
      sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity').resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({
        upload_archive_id: 'archive-1'
      });
      sinon.stub(SubmissionUploadService.prototype, 'findSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 999,
        upload_id: 'upload-1'
      });
      const publishStub = sinon
        .stub(publisher, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');

      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[1]).to.deep.equal({ submissionId: 999 });
    });

    it('should not publish job when submission_upload lookup returns null', async () => {
      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };
      sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity').resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({
        upload_archive_id: 'archive-1'
      });
      sinon.stub(SubmissionUploadService.prototype, 'findSubmissionUploadByUploadId').resolves(null);
      const publishStub = sinon
        .stub(publisher, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');

      expect(publishStub.called).to.be.false;
    });

    it('should propagate error when submission_upload lookup fails', async () => {
      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };
      sinon.stub(ObjectStorageService.prototype, 'promoteFromSecurity').resolves({ key: 'test.tar' });
      sinon.stub(UploadArchiveService.prototype, 'getUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({
        upload_archive_id: 'archive-1'
      });
      sinon.stub(SubmissionUploadService.prototype, 'findSubmissionUploadByUploadId').rejects(new Error('DB error'));

      try {
        await service.handleCleanScanResult('artifact-1', 'uploads/test.tar');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });
});
