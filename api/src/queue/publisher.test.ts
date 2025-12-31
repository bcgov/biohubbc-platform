import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { getMockDBConnection } from '../__mocks__/db';
import { JobQueues } from './jobs';
import * as pgBossService from './pg-boss-service';
import { publishMalwareScanJob, publishProcessSubmissionFeaturesJob, publishTestJob } from './publisher';

describe('publisher', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('publishTestJob', () => {
    it('publishes a job to the test queue', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const data = { message: 'test message' };
      const jobId = await publishTestJob(data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.TEST);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.TEST);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(jobId).to.equal('test-job-id');
    });

    it('uses default options when none provided', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishTestJob({ message: 'test' });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(2);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 60); // 1 hour
    });

    it('merges provided options with defaults', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishTestJob({ message: 'test' }, { retryLimit: 5, priority: 10 });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(5);
      expect(options.retryDelay).to.equal(60); // default
      expect(options.priority).to.equal(10);
    });

    it('returns null when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const jobId = await publishTestJob({ message: 'test' });

      expect(jobId).to.be.null;
    });

    it('passes singletonKey option for deduplication', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishTestJob({ message: 'test' }, { singletonKey: 'unique-key' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('unique-key');
    });

    it('passes startAfter option for delayed jobs', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const startAfter = new Date('2024-01-01T00:00:00Z');
      await publishTestJob({ message: 'test' }, { startAfter });

      const options = sendStub.firstCall.args[2];
      expect(options.startAfter).to.equal(startAfter);
    });
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

      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves({
        submission_validation_id: 1,
        job_id: 'existing-job-id',
        status: 'pending'
      });

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
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionId').resolves({
        submission_validation_id: 1,
        job_id: 'failed-job-id',
        status: 'failed'
      });
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

      const data = { quarantineId: 'quarantine-123' };
      const result = await publishMalwareScanJob(data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('scan-job-id');
    });

    it('uses malware scan options with 30 minute timeout', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob({ quarantineId: 'quarantine-456' });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 30); // 30 minutes
    });

    it('uses singletonKey based on quarantineId to prevent duplicates', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishMalwareScanJob({ quarantineId: '123' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('quarantine-123');
    });

    it('returns duplicate status when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const result = await publishMalwareScanJob({ quarantineId: 'quarantine-999' });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this quarantine record'
      );
    });

    it('returns error status when pg-boss throws', async () => {
      sinon.stub(pgBossService, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      const result = await publishMalwareScanJob({ quarantineId: 'quarantine-000' });

      expect(result.status).to.equal('error');
      expect((result as { status: 'error'; message: string }).message).to.equal('pg-boss not initialized');
    });
  });
});
