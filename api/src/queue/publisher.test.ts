import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import type { DownloadRecord } from '../models/download';
import type { SubmissionUpload } from '../models/submission-upload';
import type { SubmissionValidationRecord } from '../models/submission-validation';
import { DownloadService } from '../services/download/download-service';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { JobQueues } from './jobs';
import {
  publishComputeScopeAnchorsJob,
  publisherDependencies,
  publishIndexSubmissionFeaturesJob,
  publishMalwareScanJob,
  publishProcessDownloadJob,
  publishProcessSubmissionFeaturesJob
} from './publisher';

describe('publisher', () => {
  afterEach(() => {
    sinon.restore();
  });

  /** Default bridge record used across tests. */
  const defaultSubmissionUpload: SubmissionUpload = {
    submission_upload_id: 'sub-upload-uuid-1',
    submission_id: 123,
    upload_id: 'upload-uuid-1',
    status: 'uploaded',
    ticket_id: '11111111-1111-1111-1111-111111111111'
  };

  describe('publishProcessSubmissionFeaturesJob', () => {
    it('publishes a job and creates submission validation record', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      // No existing validation record
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);

      const createValidationStub = sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      // Full SubmissionUpload record travels through the queue
      expect(sendStub.firstCall.args[1]).to.deep.equal(defaultSubmissionUpload);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('features-job-id');

      // Verify submission validation was created with individual params
      expect(createValidationStub.calledOnce).to.be.true;
      expect(createValidationStub.firstCall.args[0]).to.equal('sub-upload-uuid-1');
      expect(createValidationStub.firstCall.args[1]).to.equal(123);
      expect(createValidationStub.firstCall.args[2]).to.equal('features-job-id');
    });

    it('uses retryLimit: 2 with exponential backoff for ingestion jobs', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(2);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 10); // 10 minutes
    });

    it('merges provided options with process submission features defaults', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload, { retryLimit: 5 });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(5);
      expect(options.expireInSeconds).to.equal(60 * 10); // Still 10 minutes
    });

    it('returns duplicate status and does not create validation when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);

      const createValidationStub = sinon.stub(SubmissionValidationService.prototype, 'createSubmissionValidation');

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission'
      );
      expect(createValidationStub.called).to.be.false;
    });

    it('uses singletonKey based on submissionId resolved from bridge to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, {
        ...defaultSubmissionUpload,
        submission_id: 456,
        submission_upload_id: 'sub-upload-uuid-2'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('submission-456');
    });

    it('passes db option to boss.send for transactional publishing', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('returns error status when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();

      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

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
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId')
        .resolves(mockValidationRecord);

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('pending');
    });

    it('allows retry when validation record exists with invalid status', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('new-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      const mockInvalidValidationRecord: SubmissionValidationRecord = {
        submission_validation_id: 1,
        job_id: 'invalid-job-id',
        status: 'invalid'
      };
      sinon
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId')
        .resolves(mockInvalidValidationRecord);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 2 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('new-job-id');
    });

    it('returns blocked status when validation record exists with completed status', async () => {
      const mockConnection = getMockDBConnection();

      const mockCompletedRecord: SubmissionValidationRecord = {
        submission_validation_id: 1,
        job_id: 'completed-job-id',
        status: 'completed'
      };
      sinon
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId')
        .resolves(mockCompletedRecord);

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('completed');
    });

    it('allows retry when validation record exists with failed status', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('new-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      const mockFailedValidationRecord: SubmissionValidationRecord = {
        submission_validation_id: 1,
        job_id: 'failed-job-id',
        status: 'failed'
      };
      sinon
        .stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId')
        .resolves(mockFailedValidationRecord);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 2 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('new-job-id');
    });
  });

  describe('publishMalwareScanJob', () => {
    it('publishes a malware scan job', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const mockConnection = getMockDBConnection();
      const data = { artifactSecurityId: 'artifact-security-123' };
      const result = await publishMalwareScanJob(mockConnection, data);

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

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob(getMockDBConnection(), { artifactSecurityId: 'artifact-security-456' });

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

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob(getMockDBConnection(), { artifactSecurityId: '123' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('artifact-security-123');
    });

    it('passes db option to boss.send for transactional publishing', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob(getMockDBConnection(), { artifactSecurityId: 'tx-test-123' });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('returns duplicate status when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const result = await publishMalwareScanJob(getMockDBConnection(), {
        artifactSecurityId: 'artifact-security-999'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this artifact security record'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishMalwareScanJob(getMockDBConnection(), {
        artifactSecurityId: 'artifact-security-000'
      });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });

  describe('publishIndexSubmissionFeaturesJob', () => {
    it('publishes an index submission features job', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const data = { submissionId: 777 };
      const result = await publishIndexSubmissionFeaturesJob(mockConnection, data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('index-job-id');
    });

    it('uses index submission features options with 10 minute timeout', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionId: 777
      });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 10); // 10 minutes
    });

    it('passes db option using caller connection for transactional job insert', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionId: 777
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('uses singletonKey based on submissionId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionId: 456
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('submission-idx-456');
    });

    it('returns duplicate status when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const result = await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionId: 777
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionId: 777
      });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });

  describe('publishProcessDownloadJob', () => {
    const createMockDownload = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
      download_id: 'aaaa0000-0000-0000-0000-000000000001',
      download_status: 'pending',
      format: 'csv',
      metadata: null,
      started_at: null,
      completed_at: null,
      downloaded_at: null,
      total_fragments: 1,
      completed_fragments: 0,
      estimated_total_size_bytes: null,
      fragment_size_bytes: '524288000',
      create_date: '2025-01-01T00:00:00Z',
      ...overrides
    });

    it('publishes job to pg-boss with correct queue and data', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(createMockDownload());

      const data = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };
      const result = await publishProcessDownloadJob(mockConnection, data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('download-job-id');
    });

    it('passes db adapter for transactional job insert', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockConnection = getMockDBConnection({ query: queryStub });
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(createMockDownload());

      await publishProcessDownloadJob(mockConnection, {
        downloadId: 'aaaa0000-0000-0000-0000-000000000001'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');

      await options.db.executeSql('SELECT 1', [42]);
      expect(queryStub).to.have.been.calledOnceWith('SELECT 1', [42]);
    });

    it('returns duplicate when download is not in pending status', async () => {
      const mockConnection = getMockDBConnection();
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
        .resolves(createMockDownload({ download_status: 'processing' }));

      const data = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };
      const result = await publishProcessDownloadJob(mockConnection, data);

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download'
      );
    });

    it('returns error when download not found', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(null);

      const data = { downloadId: 'aaaa0000-0000-0000-0000-000000000999' };
      const result = await publishProcessDownloadJob(mockConnection, data);

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('Download not found');
    });

    it('uses singletonKey based on downloadId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon
        .stub(DownloadService.prototype, 'findDownloadById')
        .resolves(createMockDownload({ download_id: 'aaaa0000-0000-0000-0000-000000000456' }));

      await publishProcessDownloadJob(mockConnection, {
        downloadId: 'aaaa0000-0000-0000-0000-000000000456'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('download-aaaa0000-0000-0000-0000-000000000456');
    });

    it('returns duplicate status when send returns null (singleton conflict)', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(createMockDownload());

      const result = await publishProcessDownloadJob(mockConnection, {
        downloadId: 'aaaa0000-0000-0000-0000-000000000001'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();

      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(createMockDownload());
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishProcessDownloadJob(mockConnection, {
        downloadId: 'aaaa0000-0000-0000-0000-000000000001'
      });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });

  describe('publishComputeScopeAnchorsJob', () => {
    it('publishes job to correct queue with securityScopeId in payload', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const data = { securityScopeId: 'scope-uuid-1' };
      const result = await publishComputeScopeAnchorsJob(mockConnection, data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('anchors-job-id');
    });

    it('uses 30 minute timeout with retry backoff', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 30);
    });

    it('passes db option using caller connection for transactional job insert', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('uses global singletonKey to serialize all anchor computation jobs', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-456' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('scope-anchors');
    });

    it('returns duplicate status when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const result = await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this security scope'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });
});
