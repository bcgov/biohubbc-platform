import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../database/db';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { getMockDBConnection } from '../../__mocks__/db';
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

  beforeEach(() => {
    sinon
      .stub(SubmissionUploadService.prototype, 'updateSubmissionUpload')
      .resolves({ submission_upload_id: 'submission-upload-1' });
  });

  const createMockJob = (
    submissionId: number,
    submissionUploadId = 'submission-upload-1',
    id = 'job-1'
  ): PgBoss.Job<IIndexSubmissionFeaturesJobData> =>
    ({
      id,
      name: 'index-submission-features',
      data: { submissionId, submissionUploadId }
    } as PgBoss.Job<IIndexSubmissionFeaturesJobData>);

  it('should index submission successfully', async () => {
    const mockDBConnection = getMockDBConnection();
    const openStub = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const releaseStub = sinon.stub();
    mockDBConnection.open = openStub;
    mockDBConnection.commit = commitStub;
    mockDBConnection.release = releaseStub;

    sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

    const indexStub = sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves();

    await indexSubmissionFeaturesJobHandler([createMockJob(777)]);

    expect(indexStub).to.have.been.calledOnce;
    expect(indexStub).to.have.been.calledOnceWith(777, 'submission-upload-1');
    expect(commitStub).to.have.been.calledOnce;
    expect(releaseStub).to.have.been.calledOnce;
  });

  it('should roll back and throw on indexing failure', async () => {
    const mainConnection = getMockDBConnection();
    const mainRollbackStub = sinon.stub().resolves();
    const mainReleaseStub = sinon.stub();
    mainConnection.open = sinon.stub().resolves();
    mainConnection.rollback = mainRollbackStub;
    mainConnection.release = mainReleaseStub;

    const statusConnection = getMockDBConnection();
    const statusOpenStub = sinon.stub().resolves();
    const statusCommitStub = sinon.stub().resolves();
    const statusReleaseStub = sinon.stub();
    statusConnection.open = statusOpenStub;
    statusConnection.commit = statusCommitStub;
    statusConnection.release = statusReleaseStub;
    statusConnection.rollback = sinon.stub().resolves();

    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');
    getConnectionStub.onFirstCall().returns(mainConnection);
    getConnectionStub.onSecondCall().returns(statusConnection);

    const testError = new Error('Indexing failed');
    sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .rejects(testError);

    try {
      await indexSubmissionFeaturesJobHandler([createMockJob(777)]);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.equal('Indexing failed');
    }

    expect(mainRollbackStub.callCount).to.be.greaterThanOrEqual(1);
    expect(mainReleaseStub).to.have.been.calledOnce;
    expect(statusOpenStub).to.have.been.calledOnce;
    expect(statusCommitStub).to.have.been.calledOnce;
    expect(statusReleaseStub).to.have.been.calledOnce;
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

    const indexStub = sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves();

    await indexSubmissionFeaturesJobHandler([
      createMockJob(1, 'submission-upload-1', 'job-1'),
      createMockJob(2, 'submission-upload-2', 'job-2')
    ]);

    expect(indexStub.callCount).to.equal(2);
    expect(openStub.callCount).to.equal(2);
    expect(commitStub.callCount).to.equal(2);
    expect(releaseStub.callCount).to.equal(2);
  });

  it('should handle empty jobs array', async () => {
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

    await indexSubmissionFeaturesJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('indexSubmissionFeaturesFailedHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should log failure with error output without throwing', async () => {
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

    const job = {
      id: 'job-1',
      name: 'index-submission-features-failed',
      data: { submissionId: 777, submissionUploadId: 'submission-upload-1' },
      output: { message: 'Indexing failed after retries' }
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    await indexSubmissionFeaturesFailedHandler([job]);

    // DLQ handler is log-only — no DB connection should be opened
    expect(getConnectionStub).not.to.have.been.called;
  });

  it('should log default message when output is null', async () => {
    const getConnectionStub = sinon.stub(db, 'getAPIUserDBConnection');

    const job = {
      id: 'job-2',
      name: 'index-submission-features-failed',
      data: { submissionId: 888, submissionUploadId: 'submission-upload-2' },
      output: null
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    await indexSubmissionFeaturesFailedHandler([job]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});
