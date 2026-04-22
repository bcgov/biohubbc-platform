import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SearchFeatureService } from '../../services/search-feature-service';
import {
  IIndexSubmissionFeaturesJobData,
  indexSubmissionFeaturesFailedHandler,
  indexSubmissionFeaturesJobHandler
} from './index-submission-features-job';

chai.use(sinonChai);

describe('indexSubmissionFeaturesJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (submissionId: number, id = 'job-1'): PgBoss.Job<IIndexSubmissionFeaturesJobData> =>
    ({
      id,
      name: 'index-submission-features',
      data: { submissionId }
    } as PgBoss.Job<IIndexSubmissionFeaturesJobData>);

  it('should index submission successfully', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const indexStub = sinon.stub(SearchFeatureService.prototype, 'indexFeaturesBySubmissionId').resolves();

    await indexSubmissionFeaturesJobHandler([createMockJob(777)]);

    expect(indexStub).to.have.been.calledOnceWith(777);
    expect(commitStub).to.have.been.calledOnce;
    expect(releaseStub).to.have.been.calledOnce;
  });

  it('should roll back and throw on indexing failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const rollbackStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const testError = new Error('Indexing failed');
    sinon.stub(SearchFeatureService.prototype, 'indexFeaturesBySubmissionId').rejects(testError);

    try {
      await indexSubmissionFeaturesJobHandler([createMockJob(777)]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Indexing failed');
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

    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    const indexStub = sinon.stub(SearchFeatureService.prototype, 'indexFeaturesBySubmissionId').resolves();

    await indexSubmissionFeaturesJobHandler([createMockJob(1, 'job-1'), createMockJob(2, 'job-2')]);

    expect(indexStub.callCount).to.equal(2);
    expect(openStub.callCount).to.equal(2);
    expect(commitStub.callCount).to.equal(2);
    expect(releaseStub.callCount).to.equal(2);
  });

  it('should handle empty jobs array', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    await indexSubmissionFeaturesJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('indexSubmissionFeaturesFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without throwing', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-1',
      name: 'index-submission-features-failed',
      data: { submissionId: 777 },
      output: { message: 'Indexing failed after retries' }
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    await indexSubmissionFeaturesFailedHandler([job]);

    // DLQ handler is log-only — no DB connection should be opened
    expect(getConnectionStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'index-submission-features-failed',
      data: { submissionId: 888 },
      output: null
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    await indexSubmissionFeaturesFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
