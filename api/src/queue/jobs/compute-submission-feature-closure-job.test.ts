import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import {
  IComputeSubmissionFeatureClosureJobData,
  computeSubmissionFeatureClosureFailedHandler,
  computeSubmissionFeatureClosureJobHandler
} from './compute-submission-feature-closure-job';

chai.use(sinonChai);

describe('computeSubmissionFeatureClosureJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (
    data: IComputeSubmissionFeatureClosureJobData,
    id = 'job-1'
  ): PgBoss.Job<IComputeSubmissionFeatureClosureJobData> =>
    ({
      id,
      name: 'compute-submission-feature-closure',
      data
    } as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>);

  it('should recompute the closure for the upload and log the inserted count', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();
    mockDBConnection.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const recomputeStub = sinon
      .stub(SubmissionFeatureClosureService.prototype, 'computeClosureForUpload')
      .resolves({ insertedCount: 42 });

    await computeSubmissionFeatureClosureJobHandler([
      createMockJob({ submissionId: 1, submissionUploadId: 'upload-uuid-1' })
    ]);

    expect(recomputeStub).to.have.been.calledOnceWith('upload-uuid-1');
    expect(mockDBConnection.commit).to.have.been.calledOnce;
  });

  it('should roll back and rethrow when the service throws', async () => {
    const mockDBConnection = getMockDBConnection();
    const rollbackStub = sinon.stub().resolves();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = sinon.stub();
    mockDBConnection.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const testError = new Error('Closure recompute failed');
    sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForUpload').rejects(testError);

    try {
      await computeSubmissionFeatureClosureJobHandler([
        createMockJob({ submissionId: 1, submissionUploadId: 'upload-uuid-1' })
      ]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Closure recompute failed');
    }

    expect(rollbackStub).to.have.been.calledOnce;
  });
});

describe('computeSubmissionFeatureClosureFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without opening a connection or calling the service', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');
    const recomputeStub = sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForUpload');

    const job = {
      id: 'job-1',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-uuid-1' },
      output: { message: 'Closure recompute failed after retries' }
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    await computeSubmissionFeatureClosureFailedHandler([job]);

    // DLQ handler is log-only — no DB connection and no service call
    expect(getConnectionStub).not.to.have.been.called;
    expect(recomputeStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    await computeSubmissionFeatureClosureFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
