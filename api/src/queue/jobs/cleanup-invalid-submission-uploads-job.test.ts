import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getMockDBConnection } from '../../__mocks__/db';
import { cleanupInvalidSubmissionUploadsJobHandler } from './cleanup-invalid-submission-uploads-job';

describe('cleanup-invalid-submission-uploads-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('cleans up invalid uploads returned by repository lookup', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
    const listStub = sinon
      .stub(SubmissionUploadService.prototype, 'getInvalidSubmissionUploadIdsForCleanup')
      .resolves(['su-1', 'su-2']);
    const cleanupStub = sinon.stub(SubmissionUploadService.prototype, 'cleanupInvalidSubmissionUploadById').resolves();

    const jobs = [{ id: 'job-1', data: {} } as PgBoss.Job<Record<string, unknown>>];
    await cleanupInvalidSubmissionUploadsJobHandler(jobs);

    expect(listStub.calledOnce).to.be.true;
    expect(cleanupStub.callCount).to.equal(2);
    expect(cleanupStub.getCall(0).args[0]).to.equal('su-1');
    expect(cleanupStub.getCall(1).args[0]).to.equal('su-2');
  });

  it('propagates cleanup errors and leaves transaction open for retry handling', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
    sinon.stub(SubmissionUploadService.prototype, 'getInvalidSubmissionUploadIdsForCleanup').resolves(['su-1', 'su-2']);
    sinon
      .stub(SubmissionUploadService.prototype, 'cleanupInvalidSubmissionUploadById')
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .rejects(new Error('cleanup failed'));

    const jobs = [{ id: 'job-1', data: {} } as PgBoss.Job<Record<string, unknown>>];

    try {
      await cleanupInvalidSubmissionUploadsJobHandler(jobs);
      expect.fail('expected cleanupInvalidSubmissionUploadsJobHandler to throw');
    } catch (error) {
      expect((error as Error).message).to.equal('cleanup failed');
    }
  });
});
