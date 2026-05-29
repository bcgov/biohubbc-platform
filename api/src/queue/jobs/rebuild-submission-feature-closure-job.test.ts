import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import {
  IRebuildSubmissionFeatureClosureJobData,
  rebuildSubmissionFeatureClosureFailedHandler,
  rebuildSubmissionFeatureClosureJobHandler
} from './rebuild-submission-feature-closure-job';

chai.use(sinonChai);

describe('rebuildSubmissionFeatureClosureJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (
    data: IRebuildSubmissionFeatureClosureJobData,
    id = 'job-1'
  ): PgBoss.Job<IRebuildSubmissionFeatureClosureJobData> =>
    ({
      id,
      name: 'rebuild-submission-feature-closure',
      data
    } as PgBoss.Job<IRebuildSubmissionFeatureClosureJobData>);

  it('should rebuild the closure for the upload and log the inserted count', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const rebuildStub = sinon
      .stub(SubmissionFeatureClosureService.prototype, 'rebuildClosureForUpload')
      .resolves({ insertedCount: 42 });

    await rebuildSubmissionFeatureClosureJobHandler([
      createMockJob({ submissionId: 1, submissionUploadId: 'upload-uuid-1' })
    ]);

    expect(rebuildStub).to.have.been.calledOnceWith('upload-uuid-1');
    expect(mockDBConnection.commit).to.have.been.calledOnce;
  });

  it('should roll back and rethrow when the service throws', async () => {
    const mockDBConnection = getMockDBConnection();
    const rollbackStub = sinon.stub().resolves();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = sinon.stub();

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const testError = new Error('Closure rebuild failed');
    sinon.stub(SubmissionFeatureClosureService.prototype, 'rebuildClosureForUpload').rejects(testError);

    try {
      await rebuildSubmissionFeatureClosureJobHandler([
        createMockJob({ submissionId: 1, submissionUploadId: 'upload-uuid-1' })
      ]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Closure rebuild failed');
    }

    expect(rollbackStub).to.have.been.calledOnce;
  });
});

describe('rebuildSubmissionFeatureClosureFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without opening a connection or calling the service', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');
    const rebuildStub = sinon.stub(SubmissionFeatureClosureService.prototype, 'rebuildClosureForUpload');

    const job = {
      id: 'job-1',
      name: 'rebuild-submission-feature-closure-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-uuid-1' },
      output: { message: 'Closure rebuild failed after retries' }
    } as unknown as PgBoss.Job<IRebuildSubmissionFeatureClosureJobData>;

    await rebuildSubmissionFeatureClosureFailedHandler([job]);

    // DLQ handler is log-only — no DB connection and no service call
    expect(getConnectionStub).not.to.have.been.called;
    expect(rebuildStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'rebuild-submission-feature-closure-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IRebuildSubmissionFeatureClosureJobData>;

    await rebuildSubmissionFeatureClosureFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
