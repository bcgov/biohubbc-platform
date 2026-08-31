import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../__mocks__/download';
import { ApiNotFoundError } from '../errors/api-error';
import type { SubmissionUpload } from '../models/submission-upload';
import type { SubmissionValidationRecord } from '../models/submission-validation';
import { DownloadVersionRepository } from '../repositories/download/download-version-repository';
import { SubmissionValidationService } from '../services/submission-validation-service';
import { JobQueues } from './jobs';
import {
  publishComputeScopeAnchorsJob,
  publishComputeSubmissionFeatureClosureJob,
  publisherDependencies,
  publishIndexSubmissionFeaturesJob,
  publishMalwareScanJob,
  publishProcessDownloadJob,
  publishProcessDownloadVersionExportJob,
  publishProcessSubmissionFeaturesJob,
  publishReconcileSubmissionFeaturesJob
} from './publisher';

type MockPgBoss = Pick<PgBoss, 'send' | 'createQueue'>;

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
    ticket_id: '11111111-1111-1111-1111-111111111111',
    blueprint_id: 1
  };

  describe('publishProcessSubmissionFeaturesJob', () => {
    it('publishes a job and creates submission validation record', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);

      const createValidationStub = sinon.stub(SubmissionValidationService.prototype, 'createSubmissionValidation');

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission upload'
      );
      expect(createValidationStub.called).to.be.false;
    });

    it('uses singletonKey based on submissionUploadId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
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
      expect(options.singletonKey).to.equal('submission-upload-sub-upload-uuid-2');
    });

    it('passes db option to boss.send for transactional publishing', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('throws when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();

      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishProcessSubmissionFeaturesJob(mockConnection, defaultSubmissionUpload);
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
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

    it('publishes when submission upload is already ingesting for idempotent resume', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, {
        ...defaultSubmissionUpload,
        status: 'ingesting'
      });

      expect(result.status).to.equal('published');
    });

    it('returns blocked status when submission upload is terminal', async () => {
      const mockConnection = getMockDBConnection();
      const getValidationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, {
        ...defaultSubmissionUpload,
        status: 'indexed'
      });

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('indexed');
      expect(getValidationStub.called).to.be.false;
    });

    it('blocks a failed submission upload from restarting at the process stage', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('features-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves(null);
      sinon
        .stub(SubmissionValidationService.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, {
        ...defaultSubmissionUpload,
        status: 'failed'
      });

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('failed');
      expect(sendStub).not.to.have.been.called;
    });

    it('returns blocked status when submission upload is not process-startable', async () => {
      const mockConnection = getMockDBConnection();
      const getValidationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );

      const result = await publishProcessSubmissionFeaturesJob(mockConnection, {
        ...defaultSubmissionUpload,
        status: 'ingested'
      });

      expect(result.status).to.equal('blocked');
      expect((result as { status: 'blocked'; existingStatus: string }).existingStatus).to.equal('ingested');
      expect(getValidationStub.called).to.be.false;
    });

    it('allows retry when validation record exists with invalid status', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('new-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishMalwareScanJob(getMockDBConnection(), { artifactSecurityId: '123' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('artifact-security-123');
    });

    it('passes db option to boss.send for transactional publishing', async () => {
      const sendStub = sinon.stub().resolves('scan-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishMalwareScanJob(getMockDBConnection(), { artifactSecurityId: 'tx-test-123' });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('returns duplicate status when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const result = await publishMalwareScanJob(getMockDBConnection(), {
        artifactSecurityId: 'artifact-security-999'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this artifact security record'
      );
    });

    it('throws when pg-boss throws', async () => {
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishMalwareScanJob(getMockDBConnection(), {
          artifactSecurityId: 'artifact-security-000'
        });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });

  describe('feature reconciliation pipeline publishers', () => {
    const cases = [
      {
        name: 'reconciliation',
        publish: publishReconcileSubmissionFeaturesJob,
        queue: JobQueues.RECONCILE_SUBMISSION_FEATURES,
        jobId: 'reconcile-job-id',
        singletonKey: 'submission-upload-reconcile-upload-1',
        duplicateMessage: 'Reconciliation job already exists'
      }
    ];

    for (const testCase of cases) {
      it(`publishes ${testCase.name} transactionally with retry defaults`, async () => {
        const mockConnection = getMockDBConnection();
        const sendStub = sinon.stub().resolves(testCase.jobId);
        const createQueueStub = sinon.stub().resolves();
        const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };
        sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

        const data = { submissionUploadId: 'upload-1' };
        const result = await testCase.publish(mockConnection, data);

        expect(createQueueStub.calledOnceWith(testCase.queue)).to.be.true;
        expect(sendStub.firstCall.args[0]).to.equal(testCase.queue);
        expect(sendStub.firstCall.args[1]).to.deep.equal(data);
        expect(sendStub.firstCall.args[2]).to.include({
          retryLimit: 3,
          retryDelay: 60,
          retryBackoff: true,
          expireInSeconds: 60 * 10,
          singletonKey: testCase.singletonKey
        });
        expect(sendStub.firstCall.args[2].db.executeSql).to.be.a('function');
        expect(result).to.deep.equal({ status: 'published', jobId: testCase.jobId });
      });

      it(`returns duplicate when the ${testCase.name} singleton already exists`, async () => {
        const sendStub = sinon.stub().resolves(null);
        const mockBoss: MockPgBoss = { send: sendStub, createQueue: sinon.stub().resolves() };
        sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

        const result = await testCase.publish(getMockDBConnection(), { submissionUploadId: 'upload-1' });

        expect(result).to.deep.equal({ status: 'duplicate', message: testCase.duplicateMessage });
      });

      it(`rethrows ${testCase.name} publisher failures`, async () => {
        sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

        try {
          await testCase.publish(getMockDBConnection(), { submissionUploadId: 'upload-1' });
          expect.fail('expected publisher to throw');
        } catch (error) {
          expect((error as Error).message).to.equal('pg-boss not initialized');
        }
      });
    }
  });

  describe('publishIndexSubmissionFeaturesJob', () => {
    it('publishes an index submission features job', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const data = { submissionUploadId: 'sub-upload-uuid-idx-1' };
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-idx-1'
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-idx-1'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('uses singletonKey based on submissionUploadId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('index-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-idx-2'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('submission-upload-idx-sub-upload-uuid-idx-2');
    });

    it('returns duplicate status when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const result = await publishIndexSubmissionFeaturesJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-idx-1'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission upload'
      );
    });

    it('throws when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishIndexSubmissionFeaturesJob(mockConnection, {
          submissionUploadId: 'sub-upload-uuid-idx-1'
        });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });

  describe('publishProcessDownloadJob', () => {
    const DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

    it('publishes job to pg-boss with correct queue and data', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord());

      const data = { downloadVersionId: DOWNLOAD_VERSION_ID };
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
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord());

      await publishProcessDownloadJob(mockConnection, {
        downloadVersionId: DOWNLOAD_VERSION_ID
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');

      await options.db.executeSql('SELECT 1', [42]);
      expect(queryStub.calledOnceWith('SELECT 1', [42])).to.be.true;
    });

    it('returns duplicate when version is not in pending status', async () => {
      const mockConnection = getMockDBConnection();
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord({ status: 'processing' }));

      const data = { downloadVersionId: DOWNLOAD_VERSION_ID };
      const result = await publishProcessDownloadJob(mockConnection, data);

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download version'
      );
    });

    it('propagates ApiNotFoundError when the version does not exist', async () => {
      const mockConnection = getMockDBConnection();
      // The repository's get* throws on a miss; the publisher has no null-guard of its own.
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .rejects(new ApiNotFoundError('Download version not found'));

      const data = { downloadVersionId: 'dddd0000-0000-0000-0000-000000000999' };

      try {
        await publishProcessDownloadJob(mockConnection, data);
        expect.fail('expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Download version not found');
      }
    });

    it('uses singletonKey based on downloadVersionId to prevent duplicates', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('download-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(
          createMockDownloadVersionStatusRecord({ download_version_id: 'dddd0000-0000-0000-0000-000000000456' })
        );

      await publishProcessDownloadJob(mockConnection, {
        downloadVersionId: 'dddd0000-0000-0000-0000-000000000456'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('download-version-dddd0000-0000-0000-0000-000000000456');
    });

    it('returns duplicate status when send returns null (singleton conflict)', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);
      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord());

      const result = await publishProcessDownloadJob(mockConnection, {
        downloadVersionId: DOWNLOAD_VERSION_ID
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this download version'
      );
    });

    it('throws when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();

      sinon
        .stub(DownloadVersionRepository.prototype, 'getDownloadVersion')
        .resolves(createMockDownloadVersionStatusRecord());
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishProcessDownloadJob(mockConnection, {
          downloadVersionId: DOWNLOAD_VERSION_ID
        });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });

  describe('publishComputeScopeAnchorsJob', () => {
    it('publishes job to correct queue with securityScopeId in payload', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

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

    it('uses 30 minute timeout with retry backoff and a 20 second cooldown', async () => {
      const clock = sinon.useFakeTimers(new Date('2026-06-24T12:00:00.000Z'));
      try {
        const mockConnection = getMockDBConnection();
        const sendStub = sinon.stub().resolves('anchors-job-id');
        const createQueueStub = sinon.stub().resolves();
        const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

        sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

        await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

        const options = sendStub.firstCall.args[2];
        expect(options.retryLimit).to.equal(3);
        expect(options.retryDelay).to.equal(60);
        expect(options.retryBackoff).to.equal(true);
        expect(options.expireInSeconds).to.equal(60 * 30);
        expect(options.startAfter).to.deep.equal(new Date('2026-06-24T12:00:20.000Z'));
      } finally {
        clock.restore();
      }
    });

    it('passes db option using caller connection for transactional job insert', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');
    });

    it('uses a per-scope singletonKey to coalesce repeated anchor computation jobs for the same scope', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-456' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('scope-anchors-scope-uuid-456');
    });

    it('honours an explicit startAfter override', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('anchors-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };
      const startAfter = new Date('2026-06-24T12:05:00.000Z');

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-456' }, { startAfter });

      const options = sendStub.firstCall.args[2];
      expect(options.startAfter).to.equal(startAfter);
    });

    it('returns duplicate status when send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const result = await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this security scope'
      );
    });

    it('throws when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishComputeScopeAnchorsJob(mockConnection, { securityScopeId: 'scope-uuid-1' });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });

  describe('publishProcessDownloadVersionExportJob', () => {
    it('uses singletonKey based on the artifact group id to dedupe export runs', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('export-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishProcessDownloadVersionExportJob(mockConnection, {
        downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000456'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('export-group-cccc0000-0000-0000-0000-000000000456');
    });

    it('uses process download version export options with 1 hour timeout', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('export-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishProcessDownloadVersionExportJob(mockConnection, {
        downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000001'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 60); // 1 hour
    });

    it('passes db option using caller connection for transactional job insert', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockConnection = getMockDBConnection({ query: queryStub });
      const sendStub = sinon.stub().resolves('export-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      await publishProcessDownloadVersionExportJob(mockConnection, {
        downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000001'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');

      await options.db.executeSql('SELECT 1', [42]);
      expect(queryStub.calledOnceWith('SELECT 1', [42])).to.be.true;
    });

    it('returns published status with jobId when boss.send returns a job ID', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('export-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const result = await publishProcessDownloadVersionExportJob(mockConnection, {
        downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000001'
      });

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT);
      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('export-job-id');
    });

    it('returns duplicate status when boss.send returns null (singleton collision or throttled)', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);

      const result = await publishProcessDownloadVersionExportJob(mockConnection, {
        downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000001'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this export artifact group'
      );
    });

    it('rethrows when pg-boss throws so the caller transaction rolls back', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishProcessDownloadVersionExportJob(mockConnection, {
          downloadVersionExportArtifactGroupId: 'cccc0000-0000-0000-0000-000000000001'
        });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });

  describe('publishComputeSubmissionFeatureClosureJob', () => {
    it('publishes a job to the correct queue with a per-upload singletonKey', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('closure-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const data = { submissionUploadId: 'sub-upload-uuid-closure-1' };
      await publishComputeSubmissionFeatureClosureJob(mockConnection, data);

      expect(createQueueStub.calledOnce).to.be.true;
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);
      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('closure-recompute-sub-upload-uuid-closure-1');
    });

    it('uses a caller-provided singleton key for distinct feature-state revisions', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('closure-job-id');
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: sinon.stub().resolves() };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeSubmissionFeatureClosureJob(
        mockConnection,
        { submissionId: 777, submissionUploadId: 'sub-upload-uuid-closure-1' },
        { singletonKey: 'closure-recompute-sub-upload-uuid-closure-1-review-7' }
      );

      expect(sendStub.firstCall.args[2].singletonKey).to.equal('closure-recompute-sub-upload-uuid-closure-1-review-7');
    });

    it('uses recompute closure options with 2 hour timeout and retry backoff', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('closure-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeSubmissionFeatureClosureJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-closure-1'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(3);
      expect(options.retryDelay).to.equal(60);
      expect(options.retryBackoff).to.equal(true);
      expect(options.expireInSeconds).to.equal(60 * 60 * 2); // 2 hours
    });

    it('passes db option using caller connection for transactional job insert', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockConnection = getMockDBConnection({ query: queryStub });
      const sendStub = sinon.stub().resolves('closure-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      await publishComputeSubmissionFeatureClosureJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-closure-1'
      });

      const options = sendStub.firstCall.args[2];
      expect(options.db).to.exist;
      expect(options.db.executeSql).to.be.a('function');

      await options.db.executeSql('SELECT 1', [42]);
      expect(queryStub.calledOnceWith('SELECT 1', [42])).to.be.true;
    });

    it('returns published status with jobId when boss.send returns a job ID', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves('closure-job-id');
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const result = await publishComputeSubmissionFeatureClosureJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-closure-1'
      });

      expect(result.status).to.equal('published');
      expect((result as { status: 'published'; jobId: string }).jobId).to.equal('closure-job-id');
    });

    it('returns duplicate status when boss.send returns null', async () => {
      const mockConnection = getMockDBConnection();
      const sendStub = sinon.stub().resolves(null);
      const createQueueStub = sinon.stub().resolves();
      const mockBoss: MockPgBoss = { send: sendStub, createQueue: createQueueStub };

      sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as unknown as PgBoss);

      const result = await publishComputeSubmissionFeatureClosureJob(mockConnection, {
        submissionUploadId: 'sub-upload-uuid-closure-1'
      });

      expect(result.status).to.equal('duplicate');
      expect((result as { status: 'duplicate'; message: string }).message).to.equal(
        'Job already exists for this submission upload'
      );
    });

    it('throws when pg-boss throws', async () => {
      const mockConnection = getMockDBConnection();
      sinon.stub(publisherDependencies, 'getPgBoss').throws(new Error('pg-boss not initialized'));

      try {
        await publishComputeSubmissionFeatureClosureJob(mockConnection, {
          submissionUploadId: 'sub-upload-uuid-closure-1'
        });
        expect.fail('expected publisher to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss not initialized');
      }
    });
  });
});
