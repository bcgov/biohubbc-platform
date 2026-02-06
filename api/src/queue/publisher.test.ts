import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { DownloadRecord } from '../models/download';
import { SubmissionValidationRecord } from '../models/submission-validation';
import { DownloadService } from '../services/download-service';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { getMockDBConnection } from '../__mocks__/db';
import { JobQueues } from './jobs';
import * as pgBossService from './pg-boss-service';
import { publishMalwareScanJob, publishProcessDownloadJob, publishProcessSubmissionFeaturesJob } from './publisher';

describe('publisher', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('publishProcessSubmissionFeaturesJob', () => {
    it('publishes a job and creates submission validation record', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      // No existing validation record
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);

      const createValidationStub = sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      const data = { submissionId: 123 };
      const result = await publishProcessSubmissionFeaturesJob(mockConnection, data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('features-job-id');

      // Verify submission validation was created
      expect(createValidationStub.calledOnce).to.be.true;
      expect(createValidationStub.firstCall.args[0]).to.equal(123);
      expect(createValidationStub.firstCall.args[1]).to.equal('features-job-id');
    });

    it('uses process submission features specific options with 10 minute timeout', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 10); // 10 minutes (not 1 hour)
    });

    it('merges provided options with process submission features defaults', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 }, { retryLimit: 5 });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(5);
      expect(options.expireInSeconds).to.equal(60 * 10); // Still 10 minutes
    });

    it('returns duplicate status and does not create validation when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);

      const createValidationStub = sinon.stub(SubmissionValidationService.prototype, 'createSubmissionValidation');

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission'
      );
      expect(createValidationStub.called).to.be.false;
    });

    it('uses singletonKey based on submissionId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 456 });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('submission-456');
    });

    it('returns error status when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();

      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves(null);
      sinon.stub(pgBossService, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });

    it('returns blocked status when validation record exists with non-failed status', async () => {
      const mockConnection = getMockDBConnection();

      const mockValidationRecord: SubmissionValidationRecord = {
        submission_validation_id: 1,
        job_id: 'existing-job-id',
        status: 'pending'
      };
      sinon
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId')
        .resolves(mockValidationRecord);

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 });

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('pending');
    });

    it('allows retry when validation record exists with failed status', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('new-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      const mockFailedValidationRecord: SubmissionValidationRecord = {
        submission_validation_id: 1,
        job_id: 'failed-job-id',
        status: 'failed'
      };
      sinon
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId')
        .resolves(mockFailedValidationRecord);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 2 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, { submissionId: 123 });

      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('new-job-id');
    });
  });

  describe('publishMalwareScanJob', () => {
    it('publishes a malware scan job', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const data = { artifactSecurityId: 'artifact-security-123' };
      const result = await publishMalwareScanJob(data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('scan-job-id');
    });

    it('uses malware scan options with 60 minute timeout', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob({ artifactSecurityId: 'artifact-security-456' });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 60); // 60 minutes
    });

    it('uses singletonKey based on artifactSecurityId to prevent duplicates', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob({ artifactSecurityId: '123' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('artifact-security-123');
    });

    it('returns duplicate status when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const result = await publishMalwareScanJob({ artifactSecurityId: 'artifact-security-999' });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this artifact security record'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      sinon.stub(pgBossService, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishMalwareScanJob({ artifactSecurityId: 'artifact-security-000' });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });

  describe('publishProcessDownloadJob', () => {
    const createMockDownload = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
      download_id: 1,
      system_user_id: 123,
      download_status: 'pending',
      s3_key: null,
      file_name: null,
      file_size_bytes: null,
      metadata: null,
      started_at: null,
      completed_at: null,
      downloaded_at: null,
      total_fragments: 1,
      completed_fragments: 0,
      estimated_total_size_bytes: null,
      fragment_size_bytes: 524288000,
      ...overrides
    });

    it('publishes job to pg-boss with correct queue and data', async () => {
      // Verifies: Job is published to pg-boss with correct queue name and data payload

      // Step 1: Setup mock pg-boss
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(createMockDownload());

      // Step 2: Call publisher
      const data = { downloadId: 1, systemUserId: 123 };
      const result = await publishProcessDownloadJob(mockConnection, data);

      // Step 3: Verify job was sent to correct queue with correct data
      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('download-job-id');
    });

    it('returns duplicate when download is not in pending status', async () => {
      // Verifies: Publisher returns duplicate status when download is already processing

      // Step 1: Setup mock with download that is already processing
      const mockConnection = getMockDBConnection();
      sinon
        .stub(DownloadService.prototype, 'getDownloadById')
        .resolves(createMockDownload({ download_status: 'processing' }));

      // Step 2: Call publisher
      const data = { downloadId: 1, systemUserId: 123 };
      const result = await publishProcessDownloadJob(mockConnection, data);

      // Step 3: Verify duplicate status returned
      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download'
      );
    });

    it('returns error when download not found', async () => {
      // Verifies: Publisher returns error status when download doesn't exist

      // Step 1: Setup mock to return null (not found)
      const mockConnection = getMockDBConnection();
      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(null);

      // Step 2: Call publisher
      const data = { downloadId: 999, systemUserId: 123 };
      const result = await publishProcessDownloadJob(mockConnection, data);

      // Step 3: Verify error status returned
      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('Download not found');
    });

    it('uses singletonKey based on downloadId to prevent duplicates', async () => {
      // Verifies: singletonKey is constructed from downloadId to prevent duplicate concurrent jobs

      // Step 1: Setup mock pg-boss
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(createMockDownload({ download_id: 456 }));

      // Step 2: Call publisher
      await publishProcessDownloadJob(mockConnection, { downloadId: 456, systemUserId: 123 });

      // Step 3: Verify singletonKey passed to pg-boss
      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('download-456');
    });

    it('returns duplicate status when send returns null (singleton conflict)', async () => {
      // Verifies: When pg-boss rejects due to singleton conflict, returns duplicate status

      // Step 1: Setup mock pg-boss to return null (singleton conflict)
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(createMockDownload());

      // Step 2: Call publisher
      const result = await publishProcessDownloadJob(mockConnection, { downloadId: 1, systemUserId: 123 });

      // Step 3: Verify duplicate status
      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      // Verifies: Exceptions from pg-boss are caught and returned as error status

      // Step 1: Setup mock that throws
      const mockConnection = getMockDBConnection();

      sinon.stub(DownloadService.prototype, 'getDownloadById').resolves(createMockDownload());
      sinon.stub(pgBossService, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      // Step 2: Call publisher
      const result = await publishProcessDownloadJob(mockConnection, { downloadId: 1, systemUserId: 123 });

      // Step 3: Verify error status
      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });
});
