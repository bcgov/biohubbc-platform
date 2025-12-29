import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { SubmissionProcessService } from '../../services/submission-process-service';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  IProcessSubmissionFeaturesJobData,
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
      const processSubmissionStub = sinon.stub(SubmissionProcessService.prototype, 'processSubmission').resolves();

      const mockJobs = [createMockJob(123)];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(updateStatusStub.calledWith('test-job-id', 'started')).to.be.true;
      expect(processSubmissionStub.calledOnceWith(123)).to.be.true;
      expect(updateStatusStub.calledWith('test-job-id', 'completed')).to.be.true;
    });

    it('rolls back and marks job as failed on processing error', async () => {
      const mockDBConnection = getMockDBConnection();
      const testError = new Error('Processing error');

      const rollbackStub = sinon.stub().resolves();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = sinon.stub();

      const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');
      getAPIUserDBConnectionStub.onFirstCall().returns(mockDBConnection);
      // Return a new connection for error tracking
      const validationConnection = getMockDBConnection();
      validationConnection.open = sinon.stub().resolves();
      validationConnection.commit = sinon.stub().resolves();
      validationConnection.release = sinon.stub();
      getAPIUserDBConnectionStub.onSecondCall().returns(validationConnection);

      const updateStatusStub = sinon
        .stub(SubmissionValidationService.prototype, 'updateSubmissionValidationStatus')
        .resolves();
      sinon.stub(SubmissionProcessService.prototype, 'processSubmission').rejects(testError);

      const mockJobs = [createMockJob(123)];

      try {
        await processSubmissionFeaturesJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
        expect(rollbackStub.calledOnce).to.be.true;
        expect(updateStatusStub.calledWith('test-job-id', 'failed')).to.be.true;
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
      sinon.stub(SubmissionProcessService.prototype, 'processSubmission').resolves();

      const mockJobs = [createMockJob(123, 'job-1'), createMockJob(456, 'job-2')];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(openStub.callCount).to.equal(2);
      expect(commitStub.callCount).to.equal(2);
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
      sinon.stub(SubmissionProcessService.prototype, 'processSubmission').resolves();

      const mockJobs = [createMockJob(123)];

      await processSubmissionFeaturesJobHandler(mockJobs);

      expect(releaseStub.calledOnce).to.be.true;
    });
  });
});
