import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import * as db from '../database/db';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { SubmissionJobQueueService } from '../services/submission-job-queue-service';
import { getMockDBConnection } from '../__mocks__/db';
import { jobQueueAttemptsWrapper, QueueJobRegistry } from './queue-registry';

describe('QueueJobRegistry', () => {
  it('returns null if no matching job found', () => {
    const job = QueueJobRegistry.findMatchingJob('not_a_real_job');

    expect(job).to.be.undefined;
  });
});

describe('jobQueueAttemptsWrapper', () => {
  it('returns a QueueJob function', () => {
    const jobFunctionMock = () => Promise.resolve();
    const wrappedJobFunction = jobQueueAttemptsWrapper(jobFunctionMock);

    expect(wrappedJobFunction).not.to.be.undefined;
    expect(typeof wrappedJobFunction).to.equal('function');
  });

  it('returns a QueueJob function that increments the attempt count', async () => {
    const mockDBConnection = getMockDBConnection({ open: sinon.stub(), commit: sinon.stub() });
    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

    const submissionJobQueueServiceStub = sinon
      .stub(SubmissionJobQueueService.prototype, 'incrementAttemptCount')
      .resolves();

    const jobFunctionMock = () => Promise.resolve();
    const jobQueueRecordStub = { submission_job_queue_id: 1 } as unknown as ISubmissionJobQueueRecord;

    const wrappedJobFunction = jobQueueAttemptsWrapper(jobFunctionMock);

    await wrappedJobFunction(jobQueueRecordStub);

    expect(mockDBConnection.open).to.have.been.calledOnce;
    expect(submissionJobQueueServiceStub).to.have.been.calledOnceWith(1);
    expect(mockDBConnection.commit).to.have.been.calledOnce;
  });
});
