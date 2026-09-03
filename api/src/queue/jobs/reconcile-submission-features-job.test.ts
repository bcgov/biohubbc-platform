import { expect } from 'chai';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SecurityService } from '../../services/security-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import {
  IReconcileSubmissionFeaturesJobData,
  reconcileSubmissionFeaturesFailedHandler,
  reconcileSubmissionFeaturesJobDependencies,
  reconcileSubmissionFeaturesJobHandler
} from './reconcile-submission-features-job';

describe('reconcile-submission-features-job', () => {
  afterEach(() => sinon.restore());

  const job = {
    id: 'job-1',
    data: { submissionUploadId: 'upload-1' }
  } as PgBoss.Job<IReconcileSubmissionFeaturesJobData>;

  function stubUpload() {
    const connection = getMockDBConnection();
    connection.open = sinon.stub().resolves();
    connection.commit = sinon.stub().resolves();
    connection.rollback = sinon.stub().resolves();
    connection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(connection);
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves({
      submission_upload_id: 'upload-1',
      submission_id: 1,
      upload_id: 'upload',
      team_id: 'team',
      ticket_id: 'ticket',
      blueprint_id: 1,
      status: 'ingested'
    });
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToReconciling').resolves();
    sinon.stub(SecurityService.prototype, 'copyPredecessorSecurityRulesToSuccessors').resolves();
  }

  it('routes a valid reconciliation directly to indexing', async () => {
    stubUpload();
    sinon.stub(SubmissionUploadReconciliationService.prototype, 'validateSubmissionFeatureSourceIdentity').resolves(0);
    sinon.stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionFeatures').resolves(null);
    const reconciled = sinon
      .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToReconciled')
      .resolves();
    const publish = sinon
      .stub(reconcileSubmissionFeaturesJobDependencies, 'publishIndexSubmissionFeaturesJob')
      .resolves({ status: 'published', jobId: 'index-1' });

    await reconcileSubmissionFeaturesJobHandler([job]);

    expect(reconciled).to.have.been.calledWith('upload-1');
    expect(publish).to.have.been.calledOnce;
  });

  it('ends pending features from the predecessor after reconciliation', async () => {
    stubUpload();
    sinon.stub(SubmissionUploadReconciliationService.prototype, 'validateSubmissionFeatureSourceIdentity').resolves(0);
    sinon.stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionFeatures').resolves('upload-0');
    const endFeatures = sinon
      .stub(SubmissionUploadReconciliationService.prototype, 'endPendingSubmissionFeatures')
      .resolves();
    sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToReconciled').resolves();
    sinon
      .stub(reconcileSubmissionFeaturesJobDependencies, 'publishIndexSubmissionFeaturesJob')
      .resolves({ status: 'published', jobId: 'index-1' });

    await reconcileSubmissionFeaturesJobHandler([job]);

    expect(endFeatures).to.have.been.calledOnceWithExactly('upload-0');
    expect(SecurityService.prototype.copyPredecessorSecurityRulesToSuccessors).to.have.been.calledOnceWithExactly(
      'upload-1',
      'upload-0'
    );
  });

  it('marks invalid source identity without reconciling or indexing', async () => {
    stubUpload();
    sinon.stub(SubmissionUploadReconciliationService.prototype, 'validateSubmissionFeatureSourceIdentity').resolves(2);
    const reconcile = sinon.stub(SubmissionUploadReconciliationService.prototype, 'reconcileSubmissionFeatures');
    const invalid = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToInvalid').resolves();
    const publish = sinon.stub(reconcileSubmissionFeaturesJobDependencies, 'publishIndexSubmissionFeaturesJob');

    await reconcileSubmissionFeaturesJobHandler([job]);

    expect(invalid).to.have.been.calledWith('upload-1');
    expect(reconcile).not.to.have.been.called;
    expect(publish).not.to.have.been.called;
  });

  it('marks the upload failed through the common transition flow once retries are exhausted', async () => {
    stubUpload();
    const toFailed = sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToFailed').resolves();

    await reconcileSubmissionFeaturesFailedHandler([job]);

    expect(toFailed).to.have.been.calledOnceWith('upload-1');
  });
});
