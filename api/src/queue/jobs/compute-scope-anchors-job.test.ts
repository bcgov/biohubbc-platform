import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { getMockDBConnection } from '../../__mocks__/db';
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

  it('should compute anchors for scope successfully with commit callback', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

    const computeStub = sinon.stub(SecurityScopeService.prototype, 'computeAnchorsForScope').resolves();

    await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);

    // Service called with scope ID and an onPhaseComplete callback
    expect(computeStub).to.have.been.calledOnce;
    expect(computeStub.firstCall.args[0]).to.equal('scope-uuid-1');
    expect(computeStub.firstCall.args[1]).to.be.a('function');

    // Final commit after service returns
    expect(commitStub).to.have.been.calledOnce;
    expect(releaseStub).to.have.been.calledOnce;
  });

  it('should roll back and throw on computation failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const rollbackStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

    const testError = new Error('Anchor computation failed');
    sinon.stub(SecurityScopeService.prototype, 'computeAnchorsForScope').rejects(testError);

    try {
      await computeScopeAnchorsJobHandler([createMockJob('scope-uuid-1')]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Anchor computation failed');
    }

    expect(rollbackStub).to.have.been.calledOnce;
    expect(releaseStub).to.have.been.calledOnce;
  });

  it('should process multiple jobs in sequence', async () => {
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();

    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

    const computeStub = sinon.stub(SecurityScopeService.prototype, 'computeAnchorsForScope').resolves();

    await computeScopeAnchorsJobHandler([createMockJob('scope-1', 'job-1'), createMockJob('scope-2', 'job-2')]);

    expect(computeStub.callCount).to.equal(2);
    expect(openStub.callCount).to.equal(2);
    expect(commitStub.callCount).to.equal(2);
    expect(releaseStub.callCount).to.equal(2);
  });

  it('should handle empty jobs array', async () => {
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

    await computeScopeAnchorsJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('computeScopeAnchorsFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without throwing', async () => {
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

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
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

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
