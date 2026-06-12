import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  IComputeSubmissionFeatureClosureJobData,
  computeSubmissionFeatureClosureFailedHandler,
  computeSubmissionFeatureClosureJobDependencies,
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

  it('should recompute the closure for the upload, publish screening job, and commit', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();
    mockDBConnection.query = sinon.stub().resolves(mockQueryResult([{ locked: true }]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const recomputeStub = sinon
      .stub(SubmissionFeatureClosureService.prototype, 'computeClosureForUpload')
      .resolves({ insertedCount: 42 });

    const publishStub = sinon
      .stub(computeSubmissionFeatureClosureJobDependencies, 'publishAutomaticSecurityScreeningJob')
      .resolves({ status: 'published', jobId: 'screen-job-1' });

    await computeSubmissionFeatureClosureJobHandler([
      createMockJob({ submissionId: 1, submissionUploadId: 'upload-uuid-1' })
    ]);

    expect(recomputeStub).to.have.been.calledOnceWith('upload-uuid-1');
    expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, {
      submissionId: 1,
      submissionUploadId: 'upload-uuid-1'
    });
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
    sinon
      .stub(computeSubmissionFeatureClosureJobDependencies, 'publishAutomaticSecurityScreeningJob')
      .resolves({ status: 'published', jobId: 'j1' });

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

  const stubConnections = () => {
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').callsFake(() => {
      const conn = getMockDBConnection();
      conn.open = sinon.stub().resolves();
      conn.commit = sinon.stub().resolves();
      conn.rollback = sinon.stub().resolves();
      conn.release = sinon.stub();
      return conn;
    });
  };

  it('marks the upload failed and logs failure without recomputing the closure', async () => {
    stubConnections();
    const recomputeStub = sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForUpload');
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-1',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionId: 1, submissionUploadId: 'upload-uuid-1' },
      output: { message: 'Closure recompute failed after retries' }
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    await computeSubmissionFeatureClosureFailedHandler([job]);

    expect(transitionStatusStub.calledWith('upload-uuid-1', 'failed', ['indexed', 'security_screened', 'failed'])).to.be
      .true;
    expect(recomputeStub).not.to.have.been.called;
  });

  it('marks the upload failed and logs default message when output is null', async () => {
    stubConnections();
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-2',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionId: 2, submissionUploadId: 'upload-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    await computeSubmissionFeatureClosureFailedHandler([job]);

    expect(transitionStatusStub.calledWith('upload-uuid-2', 'failed', ['indexed', 'security_screened', 'failed'])).to.be
      .true;
  });
});
