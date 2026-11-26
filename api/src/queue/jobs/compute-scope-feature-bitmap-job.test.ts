import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import {
  computeScopeFeatureBitmapFailedHandler,
  computeScopeFeatureBitmapJobHandler,
  IComputeScopeFeatureBitmapJobData
} from './compute-scope-feature-bitmap-job';

chai.use(sinonChai);

describe('computeScopeFeatureBitmapJobHandler', () => {
  let lockStub: sinon.SinonStub;

  beforeEach(() => {
    lockStub = sinon.stub(SecurityScopeService.prototype, 'lockScopeFeatureBitmap').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (
    securityScopeId: string,
    id = 'job-1',
    submissionId: number | null = null
  ): PgBoss.Job<IComputeScopeFeatureBitmapJobData> =>
    ({
      id,
      name: 'compute-scope-feature-bitmap',
      data: { securityScopeId, submissionId }
    } as PgBoss.Job<IComputeScopeFeatureBitmapJobData>);

  it('should resolve the URN and build the bitmap in one transaction', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const urn = { urn_submission_id: '10', urn_feature_type: 'survey', urn_feature_id: '*' };
    const resolveUrnStub = sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(urn);
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap').resolves();
    const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshScopeFeatureBitmapForSubmission');

    await computeScopeFeatureBitmapJobHandler([createMockJob('scope-uuid-1')]);

    expect(resolveUrnStub).to.have.been.calledOnceWith('scope-uuid-1');
    expect(buildStub).to.have.been.calledOnceWith('scope-uuid-1', urn);
    expect(resolveUrnStub).to.have.been.calledBefore(buildStub);
    expect(refreshStub).not.to.have.been.called;

    // The scope's row is locked before the URN is resolved, so the resolve waits for a request that is
    // giving the scope to a team and reads what it committed.
    expect(lockStub).to.have.been.calledOnceWith('scope-uuid-1');
    expect(lockStub).to.have.been.calledBefore(resolveUrnStub);

    // The active-statement check and the write share one transaction: the build has no gate of its own.
    expect(openStub).to.have.been.calledOnce;
    expect(commitStub).to.have.been.calledOnce;
    expect(commitStub).to.have.been.calledAfter(buildStub);
  });

  it("should refresh only the submission's part of the bitmap when the job carries a submission", async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const urn = { urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' };
    const resolveUrnStub = sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(urn);
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap');
    const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshScopeFeatureBitmapForSubmission').resolves();

    await computeScopeFeatureBitmapJobHandler([createMockJob('scope-uuid-1', 'job-1', 42)]);

    expect(refreshStub).to.have.been.calledOnceWith('scope-uuid-1', urn, 42);
    expect(resolveUrnStub).to.have.been.calledBefore(refreshStub);
    expect(buildStub).not.to.have.been.called;

    // The refresh shares the URN resolve's transaction, as the full build does.
    expect(openStub).to.have.been.calledOnce;
    expect(commitStub).to.have.been.calledOnce;
    expect(commitStub).to.have.been.calledAfter(refreshStub);
  });

  it('should run a job queued without a submissionId field as a full build', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const urn = { urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' };
    sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(urn);
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap').resolves();
    const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshScopeFeatureBitmapForSubmission');

    // The payload shape the previous api version queued.
    const legacyJob = {
      id: 'job-1',
      name: 'compute-scope-feature-bitmap',
      data: { securityScopeId: 'scope-uuid-1' }
    } as PgBoss.Job<IComputeScopeFeatureBitmapJobData>;

    await computeScopeFeatureBitmapJobHandler([legacyJob]);

    expect(buildStub).to.have.been.calledOnceWith('scope-uuid-1', urn);
    expect(refreshStub).not.to.have.been.called;
  });

  it('should leave the bitmap untouched when no active policy statements', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(null);
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap');
    const refreshStub = sinon.stub(SecurityScopeService.prototype, 'refreshScopeFeatureBitmapForSubmission');

    await computeScopeFeatureBitmapJobHandler([
      createMockJob('scope-uuid-1'),
      createMockJob('scope-uuid-1', 'job-2', 42)
    ]);

    expect(buildStub).not.to.have.been.called;
    expect(refreshStub).not.to.have.been.called;
  });

  it('should roll back and throw on build failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const commitStub = sinon.stub().resolves();
    const rollbackStub = sinon.stub().resolves();
    mockDBConnection.commit = commitStub;
    mockDBConnection.rollback = rollbackStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon
      .stub(SecurityScopeService.prototype, 'resolveUrnForScope')
      .resolves({ urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' });
    sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap').rejects(new Error('Bitmap build failed'));

    try {
      await computeScopeFeatureBitmapJobHandler([createMockJob('scope-uuid-1')]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Bitmap build failed');
    }

    expect(rollbackStub).to.have.been.calledOnce;
    expect(commitStub).not.to.have.been.called;
  });

  it('should reject the batch when a job fails so pg-boss retries it, while the other jobs still run', async () => {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const resolveUrnStub = sinon
      .stub(SecurityScopeService.prototype, 'resolveUrnForScope')
      .rejects(new Error('URN resolve failed'));
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap');

    try {
      await computeScopeFeatureBitmapJobHandler([createMockJob('scope-1', 'job-1'), createMockJob('scope-2', 'job-2')]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('URN resolve failed');
    }

    // Jobs in a batch start together, so the second job is attempted even though the first fails.
    expect(resolveUrnStub).to.have.been.calledTwice;
    expect(resolveUrnStub).to.have.been.calledWith('scope-1');
    expect(resolveUrnStub).to.have.been.calledWith('scope-2');
    expect(buildStub).not.to.have.been.called;
  });

  it('should process every job in a batch, each in its own transaction', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    mockDBConnection.open = openStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const urn = { urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' };
    const resolveUrnStub = sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope');
    resolveUrnStub.withArgs('scope-1').resolves(null);
    resolveUrnStub.withArgs('scope-2').resolves(urn);
    const buildStub = sinon.stub(SecurityScopeService.prototype, 'buildScopeFeatureBitmap').resolves();

    await computeScopeFeatureBitmapJobHandler([createMockJob('scope-1', 'job-1'), createMockJob('scope-2', 'job-2')]);

    // A skipped scope does not stop the scopes after it.
    expect(buildStub).to.have.been.calledOnceWith('scope-2', urn);
    expect(openStub.callCount).to.equal(2);
  });

  it('should handle empty jobs array', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    await computeScopeFeatureBitmapJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('computeScopeFeatureBitmapFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without throwing', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-1',
      name: 'compute-scope-feature-bitmap-failed',
      data: { securityScopeId: 'scope-uuid-1' },
      output: { message: 'Bitmap build failed after retries' }
    } as unknown as PgBoss.Job<IComputeScopeFeatureBitmapJobData>;

    await computeScopeFeatureBitmapFailedHandler([job]);

    // DLQ handler is log-only — no DB connection should be opened
    expect(getConnectionStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'compute-scope-feature-bitmap-failed',
      data: { securityScopeId: 'scope-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IComputeScopeFeatureBitmapJobData>;

    await computeScopeFeatureBitmapFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
