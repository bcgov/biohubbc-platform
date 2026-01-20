import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  IProcessSubmissionFeaturesJobData,
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobHandler
} from './process-submission-features-job';

describe('process-submission-features-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('processSubmissionFeaturesJobHandler', () => {
    const createMockJob = (submissionId: number, jobId = 'test-job-id') =>
      ({
        id: jobId,
        name: 'process-submission-features',
        data: { submissionId }
      } as PgBoss.Job<IProcessSubmissionFeaturesJobData>);

    it('processes submission successfully', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      const mockJobs = [createMockJob(123)];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(updateStatusStub.calledWith('test-job-id', 'started')).to.be.true;
      expect(updateStatusStub.calledWith('test-job-id', 'completed')).to.be.true;
    });

    it('rolls back and throws error on processing failure (does not update to failed)', async () => {
      const mockDBConnection = getMockDBConnection();
      const testError = new Error('Processing error');

      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .onFirstCall()
        .resolves() // 'started' succeeds
        .onSecondCall()
        .rejects(testError); // 'completed' fails (simulates processing error)

      const mockJobs = [createMockJob(123)];

      try {
        await processSubmissionFeaturesJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
        expect(rollbackStub.calledOnce).to.be.true;
        expect(releaseStub.calledOnce).to.be.true;
        // Should NOT update to 'failed' - let pg-boss retry, DLQ will handle final failure
        expect(updateStatusStub.calledWith('test-job-id', 'failed')).to.be.false;
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

      const mockJobs = [createMockJob(123, 'job-1'), createMockJob(456, 'job-2')];

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

      const mockJobs: PgBoss.Job<IProcessSubmissionFeaturesJobData>[] = [];

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

      const mockJobs = [createMockJob(123)];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(releaseStub.calledOnce).to.be.true;
    });
  });

  describe('processSubmissionFeaturesFailedHandler', () => {
    const createMockFailedJob = (submissionId: number, jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__process-submission-features',
        data: { submissionId },
        output
      } as PgBoss.JobWithMetadata<IProcessSubmissionFeaturesJobData>);

    it('updates status to failed with error from job output', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusBySubmissionIdStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionId')
        .resolves();

      const errorOutput = { message: 'Database connection failed' };
      const mockJobs = [createMockFailedJob(123, 'dlq-job-id', errorOutput)];

      await processSubmissionFeaturesFailedHandler(mockJobs);

      expect(updateStatusBySubmissionIdStub.calledOnce).to.be.true;
      expect(updateStatusBySubmissionIdStub.firstCall.args[0]).to.equal(123);
      expect(updateStatusBySubmissionIdStub.firstCall.args[1]).to.equal('failed');
      expect(updateStatusBySubmissionIdStub.firstCall.args[2]).to.deep.equal({ error: errorOutput });
    });

    it('uses default error message when job output is null', async () => {
      const mockDBConnection = getMockDBConnection();

      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const updateStatusBySubmissionIdStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionId')
        .resolves();

      const mockJobs = [createMockFailedJob(123, 'dlq-job-id', null)];

      await processSubmissionFeaturesFailedHandler(mockJobs);

      expect(updateStatusBySubmissionIdStub.firstCall.args[2]).to.deep.equal({
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
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatusBySubmissionId')
        .rejects(testError);

      const mockJobs = [createMockFailedJob(123)];

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
