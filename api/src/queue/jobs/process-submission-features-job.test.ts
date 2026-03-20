import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { SubmissionUpload } from '../../models/submission-upload';
import { ValidationErrorType } from '../../services/ingestion/submission-ingestion-service.interface';
import { SubmissionIngestionService } from '../../services/ingestion/submission-ingestion-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getMockDBConnection } from '../../__mocks__/db';
import * as publisher from '../publisher';
import {
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobHandler
} from './process-submission-features-job';

describe('process-submission-features-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  /** Default bridge record used across tests. */
  const defaultSubmissionUpload: SubmissionUpload = {
    submission_upload_id: 'test-sub-upload-id',
    submission_id: 123,
    upload_id: 'test-upload-id',
    status: 'pending',
    ticket_id: '11111111-1111-1111-1111-111111111111'
  };

  describe('processSubmissionFeaturesJobHandler', () => {
    let updateSubmissionUploadStub: sinon.SinonStub;

    beforeEach(() => {
      updateSubmissionUploadStub = sinon
        .stub(SubmissionUploadService.prototype, 'updateSubmissionUpload')
        .resolves({ submission_upload_id: 'test-sub-upload-id' });
    });

    const createMockJob = (data: Partial<SubmissionUpload> = {}, jobId = 'test-job-id') =>
      ({
        id: jobId,
        name: 'process-submission-features',
        data: { ...defaultSubmissionUpload, ...data }
      } as PgBoss.Job<SubmissionUpload>);

    it('processes submission successfully', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const mockJobs = [createMockJob()];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(updateStatusStub.calledWith('test-job-id', 'started')).to.be.true;
      expect(updateStatusStub.calledWith('test-job-id', 'completed')).to.be.true;
      expect(updateSubmissionUploadStub.calledWith('test-sub-upload-id', { status: 'in_progress' })).to.be.true;
      expect(updateSubmissionUploadStub.calledWith('test-sub-upload-id', { status: 'succeeded' })).to.be.false;
    });

    it('calls ingestSubmissionUpload with the SubmissionUpload from job data', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();

      const ingestSubmissionUploadStub = sinon
        .stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload')
        .resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const jobData: SubmissionUpload = {
        submission_upload_id: 'my-sub-upload-id',
        submission_id: 456,
        upload_id: 'my-upload-id',
        status: 'pending',
        ticket_id: '22222222-2222-2222-2222-222222222222'
      };
      const mockJobs = [createMockJob(jobData)];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(ingestSubmissionUploadStub.calledOnce).to.be.true;
      // Handler passes the job data directly — no DB lookup needed
      expect(ingestSubmissionUploadStub.firstCall.args[0]).to.deep.equal(jobData);
    });

    it('updates status to invalid on validation failure and does not throw', async () => {
      const mockDBConnection = getMockDBConnection();
      const commitStub = sinon.stub().resolves();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      const validationErrors = [
        {
          type: ValidationErrorType.INVALID_PROPERTY_TYPE,
          featureId: 'feat-1',
          featureType: 'observation',
          field: 'count',
          value: 'abc',
          message: 'Expected number'
        }
      ];

      sinon
        .stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload')
        .resolves({ valid: false, errors: validationErrors });

      const mockJobs = [createMockJob()];

      // Should NOT throw
      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(updateStatusStub.calledWith('test-job-id', 'started')).to.be.true;
      expect(updateStatusStub.calledWith('test-job-id', 'invalid', { errors: validationErrors })).to.be.true;
      expect(updateSubmissionUploadStub.calledWith('test-sub-upload-id', { status: 'invalid' })).to.be.true;
      // Should NOT set 'completed'
      expect(updateStatusStub.calledWith('test-job-id', 'completed')).to.be.false;
      // Connection should be committed (not rolled back)
      expect(commitStub.called).to.be.true;
    });

    it('rolls back and throws when ingestSubmissionUpload throws (allows pg-boss retry)', async () => {
      const mockDBConnection = getMockDBConnection();
      const testError = new Error('S3 connection failed');

      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').rejects(testError);

      const mockJobs = [createMockJob()];

      try {
        await processSubmissionFeaturesJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
        expect(rollbackStub.calledOnce).to.be.true;
        expect(releaseStub.calledOnce).to.be.true;
      }
    });

    it('processes multiple jobs in sequence', async () => {
      const openStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').callsFake(() => {
        const mockConn = getMockDBConnection();
        mockConn.open = openStub;
        mockConn.commit = commitStub;
        mockConn.release = releaseStub;
        return mockConn;
      });

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const mockJobs = [
        createMockJob({ submission_upload_id: 'sub-upload-1' }, 'job-1'),
        createMockJob({ submission_upload_id: 'sub-upload-2' }, 'job-2')
      ];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(openStub.callCount).to.equal(2);
      // 2 commits per job: one for 'started', one for 'completed'
      expect(commitStub.callCount).to.equal(4);
      expect(releaseStub.callCount).to.equal(2);
    });

    it('handles empty jobs array gracefully', async () => {
      const openStub = sinon.stub().resolves();
      sinon.stub(db, 'getAPIUserDBConnection').returns({
        open: openStub
      } as any);

      const mockJobs: PgBoss.Job<SubmissionUpload>[] = [];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(openStub.called).to.be.false;
    });

    it('releases connection in finally block on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const releaseStub = sinon.stub();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();
      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const mockJobs = [createMockJob()];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(releaseStub.calledOnce).to.be.true;
    });

    it('publishes indexing job after validation completes', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      const publishStub = sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const mockJobs = [createMockJob()];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[0]).to.equal(mockDBConnection);
      expect(publishStub.firstCall.args[1]).to.deep.equal({
        submissionId: 123
      });

      // Publish must happen after 'completed' status update
      expect(updateStatusStub.calledWith('test-job-id', 'completed')).to.be.true;
      expect(publishStub.calledAfter(updateStatusStub)).to.be.true;
    });

    it('validation succeeds even if indexing publish fails (fire-and-forget)', async () => {
      const mockDBConnection = getMockDBConnection();
      const commitStub = sinon.stub().resolves();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'error', message: 'pg-boss unavailable' });

      const mockJobs = [createMockJob()];

      // Should NOT throw — fire-and-forget
      await processSubmissionFeaturesJobHandler(mockJobs);

      // Connection should still be committed (validation succeeded)
      expect(commitStub.called).to.be.true;
    });

    it('validation succeeds when indexing publish returns duplicate', async () => {
      const mockDBConnection = getMockDBConnection();
      const commitStub = sinon.stub().resolves();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = commitStub;
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({ valid: true, errors: [] });

      sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'duplicate', message: 'Job already exists for this submission' });

      const mockJobs = [createMockJob()];

      // Should NOT throw — duplicate is acceptable
      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(commitStub.called).to.be.true;
    });

    it('does not publish indexing job when validation returns invalid', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      sinon.stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus').resolves();

      sinon.stub(SubmissionIngestionService.prototype, 'ingestSubmissionUpload').resolves({
        valid: false,
        errors: [
          {
            type: ValidationErrorType.INVALID_PROPERTY_TYPE,
            featureId: 'feat-1',
            featureType: 'observation',
            field: 'count',
            value: 'abc',
            message: 'Expected number'
          }
        ]
      });

      const publishStub = sinon
        .stub(publisher, 'publishIndexSubmissionFeaturesJob')
        .resolves({ status: 'published', jobId: 'index-job-id' });

      const mockJobs = [createMockJob()];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(publishStub.called).to.be.false;
    });
  });

  describe('processSubmissionFeaturesFailedHandler', () => {
    let updateSubmissionUploadStub: sinon.SinonStub;

    beforeEach(() => {
      updateSubmissionUploadStub = sinon
        .stub(SubmissionUploadService.prototype, 'updateSubmissionUpload')
        .resolves({ submission_upload_id: 'test-sub-upload-id' });
    });

    const createMockFailedJob = (data: Partial<SubmissionUpload> = {}, jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__process-submission-features',
        data: { ...defaultSubmissionUpload, ...data },
        output
      } as PgBoss.JobWithMetadata<SubmissionUpload>);

    it('updates submission upload status to invalid with error from job output', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusBySubmissionUploadIdStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionUploadId')
        .resolves();

      const errorOutput = { message: 'Database connection failed' };
      const mockJobs = [createMockFailedJob({}, 'dlq-job-id', errorOutput)];

      await processSubmissionFeaturesFailedHandler(mockJobs);

      expect(updateStatusBySubmissionUploadIdStub.calledOnce).to.be.true;
      expect(updateSubmissionUploadStub.calledWith('test-sub-upload-id', { status: 'invalid' })).to.be.true;
      expect(updateStatusBySubmissionUploadIdStub.firstCall.args[0]).to.equal('test-sub-upload-id');
      expect(updateStatusBySubmissionUploadIdStub.firstCall.args[1]).to.equal('failed');
      expect(updateStatusBySubmissionUploadIdStub.firstCall.args[2]).to.deep.equal({ error: errorOutput });
    });

    it('uses default error message when job output is null', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusBySubmissionUploadIdStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionUploadId')
        .resolves();

      const mockJobs = [createMockFailedJob({}, 'dlq-job-id', null)];

      await processSubmissionFeaturesFailedHandler(mockJobs);

      expect(updateStatusBySubmissionUploadIdStub.firstCall.args[2]).to.deep.equal({
        error: 'Job failed after all retries'
      });
    });

    it('rolls back and throws on error', async () => {
      const mockDBConnection = getMockDBConnection();
      const testError = new Error('Update failed');

      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionUploadId')
        .rejects(testError);

      const mockJobs = [createMockFailedJob()];

      try {
        await processSubmissionFeaturesFailedHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
        expect(rollbackStub.calledOnce).to.be.true;
        expect(releaseStub.calledOnce).to.be.true;
      }
    });
  });
});
