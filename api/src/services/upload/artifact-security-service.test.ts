import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Readable } from 'stream';
import { getMockDBConnection } from '../../__mocks__/db';
import { IDBConnection } from '../../database/db';
import { Artifact, ArtifactStatusEnum } from '../../models/artifact';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { SecurityStatusEnum } from '../../models/security-status';
import { UploadArchive } from '../../models/upload-archive';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { TicketArtifactService } from '../ticket-artifact-service';
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

  describe('executeScan', () => {
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

    const mockSecurityRecord: ArtifactSecurity = {
      artifact_security_id: 'security-1',
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.PENDING
    };

    beforeEach(() => {
      process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME = 'security-bucket';
      process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
      process.env.CLAMAV_MAX_SCAN_SIZE = '2000';
      sinon.stub(ObjectStorageService.prototype, 'getMetadata').resolves({ ContentLength: 1000 } as any);
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
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').resolves({
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
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').resolves({
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

    it('should call handleCleanScanResult and publishNextPipelineStep on clean scan', async () => {
      // Verifies: clean scan triggers post-scan file handling and downstream job publishing

      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };

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
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: false })
      } as any);

      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({ artifact_id: 'artifact-1' });
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(UploadArchiveService.prototype, 'updateUploadArchive').resolves({ upload_archive_id: 'archive-1' });
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 123,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
      const publishStub = sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      await service.executeScan('security-1');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(publishStub.calledOnce).to.be.true;
      // Publisher receives the full SubmissionUpload record
      expect(publishStub.firstCall.args[1]).to.deep.equal({
        submission_upload_id: 'su-1',
        submission_id: 123,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });
    });

    it('keeps ticket artifact stable while promoting a clean ticket attachment', async () => {
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
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: false })
      } as any);

      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(null);
      const promoteStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      const updateArtifactStub = sinon.stub(ArtifactService.prototype, 'updateArtifact').resolves({
        artifact_id: 'artifact-1'
      });
      const insertTicketArtifactsStub = sinon
        .stub(TicketArtifactService.prototype, 'insertTicketArtifacts')
        .resolves([]);
      const publishStub = sinon.stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob');

      await service.executeScan('security-1');

      expect(promoteStub.calledOnceWith('uploads/test.tar')).to.be.true;
      expect(updateArtifactStub.calledOnceWith('artifact-1', { bucket: 'main-bucket' })).to.be.true;
      expect(insertTicketArtifactsStub.called).to.be.false;
      expect(publishStub.called).to.be.false;
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
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').rejects(testError);

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

    it('should fail scan when object exceeds CLAMAV_MAX_SCAN_SIZE', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      (ObjectStorageService.prototype.getMetadata as sinon.SinonStub).resolves({ ContentLength: 3000 } as any);

      try {
        await service.executeScan('security-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('File size 3000 exceeds CLAMAV_MAX_SCAN_SIZE 2000');
        expect(updateScanStub.calledWith('scan-1', sinon.match({ scan_status: ProcessStatusStatusEnum.FAILED }))).to.be
          .true;
      }
    });

    it('should strip null bytes from failed scan error results', async () => {
      const testError = new Error('INSTREAM size limit exceeded. ERROR\u0000');

      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').rejects(testError);

      try {
        await service.executeScan('security-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect(err).to.equal(testError);
        expect(updateScanStub.lastCall.args[1].results).to.deep.include({
          error: 'INSTREAM size limit exceeded. ERROR'
        });
      }
    });

    it('does not commit CLEAN security, unblock archive, or promote S3 when clean-scan publish throws', async () => {
      // Verifies the orphan-prevention ordering in `executeScan`:
      // publish must run BEFORE the CLEAN security write, the archive unblock, and the S3 promote.
      // If publish throws, none of those irreversible writes must happen — so the scan can be retried
      // from a fresh PENDING state. The outer catch still commits the FAILED scan row for audit.

      const mockUploadArchive: UploadArchive = {
        upload_archive_id: 'archive-1',
        upload_id: 'upload-1',
        artifact_id: 'artifact-1',
        archive_status: ProcessStatusStatusEnum.BLOCKED
      };

      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(mockArtifact);
      sinon
        .stub(ArtifactSecurityScanService.prototype, 'insertArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      // scanArtifactObject internals — clean scan outcome.
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from('test-data'));
      sinon.stub(ArtifactSecurityService.dependencies, 'getClamAvScanner').resolves({
        scanStream: sinon.stub().resolves({ isInfected: false })
      } as any);

      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(mockUploadArchive);
      sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId').resolves({
        submission_upload_id: 'su-1',
        submission_id: 123,
        upload_id: 'upload-1',
        status: 'uploaded',
        ticket_id: '11111111-1111-1111-1111-111111111111'
      });

      sinon
        .stub(ArtifactSecurityService.dependencies, 'publishProcessSubmissionFeaturesJob')
        .rejects(new Error('pg-boss unavailable'));

      // Spies on the writes that must NOT happen when publish throws.
      const updateArtifactSecurityStub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves(mockSecurityRecord);
      const promoteFromSecurityStub = sinon
        .stub(ObjectStorageService.prototype, 'promoteFromSecurity')
        .resolves({ key: 'test.tar' });
      const updateUploadArchiveStub = sinon
        .stub(UploadArchiveService.prototype, 'updateUploadArchive')
        .resolves({ upload_archive_id: 'archive-1' });

      // Spy on the scan-row FAILED update that MUST happen (outer catch).
      const updateScanStub = sinon
        .stub(ArtifactSecurityScanService.prototype, 'updateArtifactSecurityScan')
        .resolves({ artifact_security_scan_id: 'scan-1' });

      try {
        await service.executeScan('security-1');
        expect.fail('expected executeScan to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');

        // The reorder's whole point: CLEAN was never committed.
        expect(
          updateArtifactSecurityStub.neverCalledWith(
            sinon.match.any,
            sinon.match({ security: SecurityStatusEnum.CLEAN })
          )
        ).to.be.true;

        // S3 promote never happened.
        expect(promoteFromSecurityStub.called).to.be.false;

        // Archive stayed BLOCKED.
        expect(updateUploadArchiveStub.called).to.be.false;

        // Outer catch still committed the audit trail.
        expect(updateScanStub.calledWith(sinon.match.any, sinon.match({ scan_status: ProcessStatusStatusEnum.FAILED })))
          .to.be.true;
      }
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
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
        .resolves();

      await service.failSubmissionUploadByArtifactSecurityId('uuid-1');

      expect(transitionStub).to.have.been.calledOnceWith('su-1', 'failed', [
        'uploaded',
        'ingesting',
        'ingested',
        'reconciling',
        'reconciled',
        'indexing',
        'failed'
      ]);
    });

    it('is a no-op when the artifact has no upload_archive', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);
      sinon.stub(UploadArchiveService.prototype, 'findUploadArchiveByArtifactId').resolves(null);
      const getSubmissionUploadStub = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadByUploadId');
      const transitionStub = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus');

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
      const transitionStub = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus');

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
