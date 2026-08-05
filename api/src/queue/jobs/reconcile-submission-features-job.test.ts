import chai, { expect } from 'chai';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  IReconcileSubmissionFeaturesJobData,
  reconcileSubmissionFeaturesFailedHandler,
  reconcileSubmissionFeaturesJobDependencies,
  reconcileSubmissionFeaturesJobHandler
} from './reconcile-submission-features-job';

chai.use(sinonChai);

const JOB_DATA: IReconcileSubmissionFeaturesJobData = { submissionUploadId: 'upload-1' };
const createJob = (data = JOB_DATA): PgBoss.Job<IReconcileSubmissionFeaturesJobData> =>
  ({ id: 'job-1', name: 'reconcile-submission-features', data } as PgBoss.Job<IReconcileSubmissionFeaturesJobData>);

describe('reconcile-submission-features-job', () => {
  afterEach(() => sinon.restore());

  function stubConnection() {
    const connection = getMockDBConnection();
    connection.open = sinon.stub().resolves();
    connection.commit = sinon.stub().resolves();
    connection.rollback = sinon.stub().resolves();
    connection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
    return connection;
  }

  function stubUpload(status: 'ingested' | 'reconciling' | 'indexed' = 'ingested') {
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves({
      submission_upload_id: 'upload-1',
      submission_id: 9,
      upload_id: 'source-upload-1',
      team_id: 'team-1',
      ticket_id: 'ticket-1',
      blueprint_id: 1,
      status
    });
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToReconciling').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToReconciled').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToInvalid').resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadStatus').resolves();
  }

  it('reconciles a valid upload', async () => {
    stubConnection();
    stubUpload();
    sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionUploadFeatures')
      .resolves({ new: 1, unchanged: 2, superseded: 3, conflict: 0 });
    const publish = sinon
      .stub(reconcileSubmissionFeaturesJobDependencies, 'publishPromoteSubmissionFeaturesJob')
      .resolves({ status: 'published', jobId: 'promote-1' });

    await reconcileSubmissionFeaturesJobHandler([createJob()]);

    expect(SubmissionUploadService.prototype.transitionSubmissionUploadToReconciling).to.have.been.calledOnceWith(
      'upload-1'
    );
    expect(SubmissionUploadService.prototype.transitionSubmissionUploadToReconciled).to.have.been.calledOnceWith(
      'upload-1'
    );
    expect(publish).to.have.been.calledOnce;
    expect(publish.firstCall.args[1]).to.eql(JOB_DATA);
  });

  it('marks a conflicted reconciliation invalid', async () => {
    stubConnection();
    stubUpload();
    sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionUploadFeatures')
      .resolves({ new: 1, unchanged: 0, superseded: 0, conflict: 1 });
    const publish = sinon.stub(reconcileSubmissionFeaturesJobDependencies, 'publishPromoteSubmissionFeaturesJob');

    await reconcileSubmissionFeaturesJobHandler([createJob()]);

    expect(SubmissionUploadService.prototype.transitionSubmissionUploadToInvalid).to.have.been.calledOnceWith(
      'upload-1'
    );
    expect(SubmissionUploadService.prototype.transitionSubmissionUploadToReconciled).not.to.have.been.called;
    expect(publish).not.to.have.been.called;
  });

  it('skips uploads outside the reconciliation start states', async () => {
    stubConnection();
    stubUpload('indexed');
    const reconcile = sinon.stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionUploadFeatures');

    await reconcileSubmissionFeaturesJobHandler([createJob()]);

    expect(reconcile).not.to.have.been.called;
  });

  it('rolls back and retries when promotion enqueue fails', async () => {
    const connection = stubConnection();
    stubUpload();
    sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionUploadFeatures')
      .resolves({ new: 1, unchanged: 0, superseded: 0, conflict: 0 });
    sinon
      .stub(reconcileSubmissionFeaturesJobDependencies, 'publishPromoteSubmissionFeaturesJob')
      .rejects(new Error('queue unavailable'));

    try {
      await reconcileSubmissionFeaturesJobHandler([createJob()]);
      expect.fail('Expected enqueue failure');
    } catch (error) {
      expect((error as Error).message).to.equal('queue unavailable');
    }
    expect(connection.rollback).to.have.been.calledOnce;
  });

  it('marks exhausted reconciliation work failed from resumable states', async () => {
    stubConnection();
    stubUpload();

    await reconcileSubmissionFeaturesFailedHandler([createJob()]);

    expect(SubmissionUploadService.prototype.transitionSubmissionUploadStatus).to.have.been.calledOnceWith(
      'upload-1',
      'failed',
      ['ingested', 'reconciling', 'failed']
    );
  });
});
