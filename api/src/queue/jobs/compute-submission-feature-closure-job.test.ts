import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
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
  beforeEach(() => {
    sinon.stub(SecurityScopeService.prototype, 'triggerAnchorComputationForSubmission').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves({
      submission_upload_id: 'upload-uuid-1',
      submission_id: 1,
      upload_id: '11111111-1111-4111-8111-111111111111',
      status: 'indexed',
      ticket_id: '22222222-2222-4222-8222-222222222222',
      blueprint_id: 1
    });
  });

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

  it('should recompute the closure for the submission, publish screening job, and commit', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();
    mockDBConnection.query = sinon.stub().resolves(mockQueryResult([]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const recomputeStub = sinon
      .stub(SubmissionFeatureClosureService.prototype, 'computeClosureForSubmission')
      .resolves({ insertedCount: 42 });

    const publishStub = sinon
      .stub(computeSubmissionFeatureClosureJobDependencies, 'publishSubmissionUploadSecurityJob')
      .resolves({ status: 'published', jobId: 'screen-job-1' });

    await computeSubmissionFeatureClosureJobHandler([createMockJob({ submissionUploadId: 'upload-uuid-1' })]);

    expect(recomputeStub).to.have.been.calledOnceWith(1);
    expect(SecurityScopeService.prototype.triggerAnchorComputationForSubmission).to.have.been.calledOnceWith(1);
    expect(mockDBConnection.query).to.have.been.calledOnceWith(
      "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2::text, $3))",
      ['submission-feature-active-state', 1, 3]
    );
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
    mockDBConnection.query = sinon.stub().resolves(mockQueryResult([]));

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
    sinon
      .stub(computeSubmissionFeatureClosureJobDependencies, 'publishSubmissionUploadSecurityJob')
      .resolves({ status: 'published', jobId: 'j1' });

    const testError = new Error('Closure recompute failed');
    sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForSubmission').rejects(testError);

    try {
      await computeSubmissionFeatureClosureJobHandler([createMockJob({ submissionUploadId: 'upload-uuid-1' })]);
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

  it('logs failure without transitioning the upload or recomputing the closure', async () => {
    const recomputeStub = sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForSubmission');

    const job = {
      id: 'job-1',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionUploadId: 'upload-uuid-1' },
      output: { message: 'Closure recompute failed after retries' }
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    // `indexed` is terminal and screening is independent, so a failed closure must not change
    // the upload status — the handler only logs.
    await computeSubmissionFeatureClosureFailedHandler([job]);

    expect(recomputeStub).not.to.have.been.called;
  });

  it('logs the default message when output is null without recomputing the closure', async () => {
    const recomputeStub = sinon.stub(SubmissionFeatureClosureService.prototype, 'computeClosureForSubmission');

    const job = {
      id: 'job-2',
      name: 'compute-submission-feature-closure-failed',
      data: { submissionUploadId: 'upload-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IComputeSubmissionFeatureClosureJobData>;

    await computeSubmissionFeatureClosureFailedHandler([job]);

    expect(recomputeStub).not.to.have.been.called;
  });
});
