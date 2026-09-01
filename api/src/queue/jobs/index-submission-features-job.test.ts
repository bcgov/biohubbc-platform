import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionFeaturePropertyIngestionService } from '../../services/ingestion/submission-feature-property-ingestion-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  IIndexSubmissionFeaturesJobData,
  indexSubmissionFeaturesFailedHandler,
  indexSubmissionFeaturesJobDependencies,
  indexSubmissionFeaturesJobHandler
} from './index-submission-features-job';

chai.use(sinonChai);

describe('indexSubmissionFeaturesJobHandler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (
    submissionUploadId = 'submission-upload-1',
    id = 'job-1'
  ): PgBoss.Job<IIndexSubmissionFeaturesJobData> =>
    ({
      id,
      name: 'index-submission-features',
      data: { submissionUploadId }
    } as PgBoss.Job<IIndexSubmissionFeaturesJobData>);

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

  beforeEach(() => {
    stubConnections();
    const upload = {
      submission_upload_id: 'submission-upload-1',
      submission_id: 777,
      upload_id: 'upload-1',
      status: 'promoted',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      blueprint_id: 1
    } as const;
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUpload').resolves(upload);
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves(upload);
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToIndexing').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToInvalid').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToIndexed').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus').resolves();
    sinon
      .stub(indexSubmissionFeaturesJobDependencies, 'publishComputeSubmissionFeatureClosureJob')
      .resolves({ status: 'published', jobId: 'job-xyz' });
  });

  it('indexes successfully and sets indexed', async () => {
    const indexStub = sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves({ status: 'ok' });

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    const toIndexingStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIndexing as sinon.SinonStub;
    const toIndexedStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIndexed as sinon.SinonStub;
    const publishStub =
      indexSubmissionFeaturesJobDependencies.publishComputeSubmissionFeatureClosureJob as sinon.SinonStub;
    expect(toIndexingStub.calledWith('submission-upload-1')).to.be.true;
    expect(indexStub.calledOnceWith(777, 'submission-upload-1')).to.be.true;
    expect(toIndexedStub.calledWith('submission-upload-1')).to.be.true;
    expect(publishStub.calledOnce).to.be.true;
    expect(publishStub.firstCall.args[1]).to.deep.equal({
      submissionUploadId: 'submission-upload-1'
    });
    // The closure recompute must be queued only after the upload reaches `indexed`.
    expect(toIndexedStub.calledBefore(publishStub)).to.be.true;
  });

  it('marks invalid for deterministic validation outcomes', async () => {
    sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves({
        status: 'invalid',
        errorCount: 1,
        errorCounts: [{ error_code: 'TYPE_MISMATCH', error_count: 1 }],
        errorSummaries: []
      });

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    const toInvalidStub = SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid as sinon.SinonStub;
    const publishStub =
      indexSubmissionFeaturesJobDependencies.publishComputeSubmissionFeatureClosureJob as sinon.SinonStub;
    expect(toInvalidStub.calledWith('submission-upload-1')).to.be.true;
    // An invalid outcome must not enqueue a closure recompute — prior closure rows stay untouched.
    expect(publishStub.notCalled).to.be.true;
  });

  it('skips work when status is terminal', async () => {
    (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
      submission_upload_id: 'submission-upload-1',
      submission_id: 777,
      upload_id: 'upload-1',
      status: 'indexed',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      blueprint_id: 1
    });

    const indexStub = sinon.stub(
      SubmissionFeaturePropertyIngestionService.prototype,
      'indexSubmissionPropertiesBySubmissionUploadId'
    );

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    const toIndexingStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIndexing as sinon.SinonStub;
    expect(indexStub.called).to.be.false;
    expect(toIndexingStub.called).to.be.false;
  });

  it('skips work when status is not index-startable', async () => {
    (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
      submission_upload_id: 'submission-upload-1',
      submission_id: 777,
      upload_id: 'upload-1',
      status: 'uploaded',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      blueprint_id: 1
    });

    const indexStub = sinon.stub(
      SubmissionFeaturePropertyIngestionService.prototype,
      'indexSubmissionPropertiesBySubmissionUploadId'
    );

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    const toIndexingStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIndexing as sinon.SinonStub;
    expect(indexStub.called).to.be.false;
    expect(toIndexingStub.called).to.be.false;
  });

  it('rethrows on unexpected errors without marking failed before queue retries are exhausted', async () => {
    const testError = new Error('Indexing failed');
    sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .rejects(testError);

    try {
      await indexSubmissionFeaturesJobHandler([createMockJob()]);
      expect.fail('expected throw');
    } catch (error) {
      expect(error).to.equal(testError);
    }

    const transitionStatusStub = SubmissionUploadService.prototype.transitionSubmissionUploadStatus as sinon.SinonStub;
    expect(transitionStatusStub.called).to.be.false;
  });

  it('allows retry/resume when status is already indexing', async () => {
    (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
      submission_upload_id: 'submission-upload-1',
      submission_id: 777,
      upload_id: 'upload-1',
      status: 'indexing',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      blueprint_id: 1
    });

    const indexStub = sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves({ status: 'ok' });

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    expect(indexStub.calledOnceWith(777, 'submission-upload-1')).to.be.true;
  });

  it('skips retry when status is failed because failed uploads restart from processing', async () => {
    (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves({
      submission_upload_id: 'submission-upload-1',
      submission_id: 777,
      upload_id: 'upload-1',
      status: 'failed',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      blueprint_id: 1
    });

    const indexStub = sinon.stub(
      SubmissionFeaturePropertyIngestionService.prototype,
      'indexSubmissionPropertiesBySubmissionUploadId'
    );

    await indexSubmissionFeaturesJobHandler([createMockJob()]);

    const toIndexingStub = SubmissionUploadService.prototype.transitionSubmissionUploadToIndexing as sinon.SinonStub;
    expect(indexStub.called).to.be.false;
    expect(toIndexingStub.called).to.be.false;
  });

  it('processes multiple jobs in sequence', async () => {
    (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub)
      .onFirstCall()
      .resolves({
        submission_upload_id: 'upload-1',
        submission_id: 1,
        upload_id: 'artifact-1',
        status: 'promoted',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        blueprint_id: 1
      })
      .onSecondCall()
      .resolves({
        submission_upload_id: 'upload-2',
        submission_id: 2,
        upload_id: 'artifact-2',
        status: 'promoted',
        ticket_id: '22222222-2222-2222-2222-222222222222',
        blueprint_id: 1
      });
    const indexStub = sinon
      .stub(SubmissionFeaturePropertyIngestionService.prototype, 'indexSubmissionPropertiesBySubmissionUploadId')
      .resolves({ status: 'ok' });

    await indexSubmissionFeaturesJobHandler([createMockJob('upload-1', 'job-1'), createMockJob('upload-2', 'job-2')]);

    expect(indexStub.callCount).to.equal(2);
    expect(indexStub.firstCall.calledWith(1, 'upload-1')).to.be.true;
    expect(indexStub.secondCall.calledWith(2, 'upload-2')).to.be.true;
  });

  it('should handle empty jobs array', async () => {
    sinon.restore();
    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');

    await indexSubmissionFeaturesJobHandler([]);

    expect(getConnectionStub).not.to.have.been.called;
  });
});

describe('indexSubmissionFeaturesFailedHandler', () => {
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

  it('marks upload failed and logs failure with error output without throwing', async () => {
    stubConnections();
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-1',
      name: 'index-submission-features-failed',
      data: { submissionUploadId: 'submission-upload-1' },
      output: { message: 'failed after retries' }
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    let thrownError: unknown;
    try {
      await indexSubmissionFeaturesFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(transitionStatusStub.calledWith('submission-upload-1', 'failed', ['promoted', 'indexing', 'failed'])).to.be
      .true;
  });

  it('should mark upload failed and log default message when output is null', async () => {
    stubConnections();
    const transitionStatusStub = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus')
      .resolves();

    const job = {
      id: 'job-2',
      name: 'index-submission-features-failed',
      data: { submissionUploadId: 'submission-upload-2' },
      output: null
    } as unknown as PgBoss.Job<IIndexSubmissionFeaturesJobData>;

    let thrownError: unknown;
    try {
      await indexSubmissionFeaturesFailedHandler([job]);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).to.be.undefined;
    expect(transitionStatusStub.calledWith('submission-upload-2', 'failed', ['promoted', 'indexing', 'failed'])).to.be
      .true;
  });
});
