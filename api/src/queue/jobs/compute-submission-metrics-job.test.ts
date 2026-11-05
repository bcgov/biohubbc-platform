import { expect } from 'chai';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { dbDependencies } from '../../database/db';
import { SubmissionMetricsService } from '../../services/submission-metrics-service';
import { computeSubmissionMetricsJobHandler, IComputeSubmissionMetricsJobData } from './compute-submission-metrics-job';

describe('computeSubmissionMetricsJobHandler', () => {
  afterEach(() => sinon.restore());

  const job = { id: 'metrics-job', data: {} } as PgBoss.Job<IComputeSubmissionMetricsJobData>;

  it('commits a successful snapshot and releases its connection', async () => {
    const connection = getMockDBConnection();
    const commit = sinon.stub(connection, 'commit').resolves();
    const release = sinon.stub(connection, 'release');
    sinon.stub(dbDependencies, 'getAPIUserDBConnection').returns(connection);
    const calculate = sinon
      .stub(SubmissionMetricsService.prototype, 'calculateMetrics')
      .resolves('11111111-1111-4111-8111-111111111111');

    await computeSubmissionMetricsJobHandler([job]);

    expect(calculate.calledOnce).to.equal(true);
    expect(commit.calledOnce).to.equal(true);
    expect(release.calledOnce).to.equal(true);
  });

  it('rolls back a failed snapshot and rethrows for queue retries', async () => {
    const connection = getMockDBConnection();
    const commit = sinon.stub(connection, 'commit').resolves();
    const rollback = sinon.stub(connection, 'rollback').resolves();
    const release = sinon.stub(connection, 'release');
    sinon.stub(dbDependencies, 'getAPIUserDBConnection').returns(connection);
    const failure = new Error('calculation failed');
    sinon.stub(SubmissionMetricsService.prototype, 'calculateMetrics').rejects(failure);

    let caught: unknown;
    try {
      await computeSubmissionMetricsJobHandler([job]);
    } catch (error) {
      caught = error;
    }
    expect(caught).to.equal(failure);
    expect(commit.called).to.equal(false);
    expect(rollback.calledOnce).to.equal(true);
    expect(release.calledOnce).to.equal(true);
  });
});
