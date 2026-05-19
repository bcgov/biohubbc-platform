import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import {
  computeScopeAnchorsFailedHandler,
  computeScopeAnchorsJobHandler,
  IComputeScopeAnchorsJobData
} from './compute-scope-anchors-job';

chai.use(sinonChai);

describe('computeScopeAnchorsJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (securityScopeId: string, id = 'job-1'): PgBoss.Job<IComputeScopeAnchorsJobData> =>
    ({
      id,
      name: 'compute-scope-anchors',
      data: { securityScopeId }
    } as PgBoss.Job<IComputeScopeAnchorsJobData>);

  it('should compute anchors using one connection per phase', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const resolveUrnStub = sinon
      .stub(SecurityScopeService.prototype, 'resolveUrnForScope')
      .resolves({ urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' });

    // Phase 2: stale delete loop — one batch with data, one null to stop
    const deleteStaleStub = sinon.stub(SecurityScopeService.prototype, 'deleteStaleAnchorBatch');
    deleteStaleStub.onFirstCall().resolves({ pageLastId: 500 });
    deleteStaleStub.onSecondCall().resolves(null);

    // Phase 3: insert loop — one batch with data, one null to stop
    const batchStub = sinon.stub(SecurityScopeService.prototype, 'computeAnchorBatch');
    batchStub.onFirstCall().resolves({ pageLastId: 100 });
    batchStub.onSecondCall().resolves(null);

    await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);

    // Phase 1: resolve URN
    expect(resolveUrnStub).to.have.been.calledOnceWith('scope-uuid-1');

    // Phase 2: stale delete loop (two calls — one batch + null terminator)
    expect(deleteStaleStub).to.have.been.calledTwice;

    // Phase 3: insert loop (two calls — one batch + null terminator)
    expect(batchStub).to.have.been.calledTwice;

    // 5 phases total (resolve URN, stale batch 1, stale batch 2, insert batch 1, insert batch 2)
    expect(openStub.callCount).to.equal(5);
    expect(commitStub.callCount).to.equal(5);
    expect(releaseStub.callCount).to.equal(5);
  });

  it('should stop after URN resolve when no active policy statements', async () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(null);
    sinon.stub(SecurityScopeService.prototype, 'deleteOrphanedScopeData').resolves();
    const deleteStaleStub = sinon.stub(SecurityScopeService.prototype, 'deleteStaleAnchorBatch');
    const batchStub = sinon.stub(SecurityScopeService.prototype, 'computeAnchorBatch');

    await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);

    // Neither batch phase should be reached after orphan detection
    expect(deleteStaleStub).not.to.have.been.called;
    expect(batchStub).not.to.have.been.called;

    // 2 connections: resolve URN + deleteOrphanedScopeData
    expect(mockDBConnection.open).to.have.been.calledTwice;
  });

  it('should roll back and throw on computation failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const rollbackStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon
      .stub(SecurityScopeService.prototype, 'resolveUrnForScope')
      .resolves({ urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' });

    const testError = new Error('Anchor computation failed');
    sinon.stub(SecurityScopeService.prototype, 'deleteStaleAnchorBatch').rejects(testError);

    try {
      await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Anchor computation failed');
    }

    // 2 connections: resolve URN (committed) + stale batch (rolled back)
    expect(rollbackStub).to.have.been.calledOnce;
    expect(releaseStub).to.have.been.calledTwice;
  });

  it('should roll back only the failed batch on mid-batch failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const commitStub = sinon.stub().resolves();
    const rollbackStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = commitStub;
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon
      .stub(SecurityScopeService.prototype, 'resolveUrnForScope')
      .resolves({ urn_submission_id: '*', urn_feature_type: '*', urn_feature_id: '*' });

    // Stale delete completes in one batch
    const deleteStaleStub = sinon.stub(SecurityScopeService.prototype, 'deleteStaleAnchorBatch');
    deleteStaleStub.onFirstCall().resolves(null);

    const batchStub = sinon.stub(SecurityScopeService.prototype, 'computeAnchorBatch');
    batchStub.onFirstCall().resolves({ pageLastId: 100 });
    batchStub.onSecondCall().rejects(new Error('Batch 2 failed'));

    try {
      await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Batch 2 failed');
    }

    // 3 committed phases (resolve URN, stale batch 1, insert batch 1), 1 rolled back (insert batch 2)
    expect(commitStub.callCount).to.equal(3);
    expect(rollbackStub.callCount).to.equal(1);
  });

  it('should process multiple jobs in sequence', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    sinon.stub(SecurityScopeService.prototype, 'resolveUrnForScope').resolves(null);

    await computeScopeAnchorsJobHandler([createMockJob('scope-1', 'job-1'), createMockJob('scope-2', 'job-2')]);

    // Each job: resolve URN (null → orphan path, no stale/insert batches) = 1 connection per job
    // Plus deleteOrphanedScopeData = 1 connection per job = 2 per job
    expect(openStub.callCount).to.equal(4);
  });

  it('should handle empty jobs array', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    await computeScopeAnchorsJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('computeScopeAnchorsFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without throwing', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-1',
      name: 'compute-scope-anchors-failed',
      data: { securityScopeId: 'scope-uuid-1' },
      output: { message: 'Anchor computation failed after retries' }
    } as unknown as PgBoss.Job<IComputeScopeAnchorsJobData>;

    await computeScopeAnchorsFailedHandler([job]);

    // DLQ handler is log-only — no DB connection should be opened
    expect(getConnectionStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'compute-scope-anchors-failed',
      data: { securityScopeId: 'scope-uuid-2' },
      output: null
    } as unknown as PgBoss.Job<IComputeScopeAnchorsJobData>;

    await computeScopeAnchorsFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
