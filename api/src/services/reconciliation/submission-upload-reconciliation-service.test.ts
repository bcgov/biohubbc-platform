import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { SubmissionUploadReconciliationService } from './submission-upload-reconciliation-service';

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('SubmissionUploadReconciliationService', () => {
  afterEach(() => sinon.restore());

  function stubUpload() {
    sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUpload').resolves({
      submission_upload_id: UPLOAD_ID,
      submission_id: 9,
      upload_id: '660e8400-e29b-41d4-a716-446655440000',
      team_id: '880e8400-e29b-41d4-a716-446655440000',
      ticket_id: '770e8400-e29b-41d4-a716-446655440000',
      blueprint_id: 1,
      status: 'indexed'
    });
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
  }

  it('replaces source identity errors and returns the invalid feature occurrence count', async () => {
    const deleteErrors = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'deleteSourceIdentityErrors')
      .resolves();
    const insertErrors = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'insertSourceIdentityErrors')
      .resolves(3);
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());

    expect(await service.validateSubmissionFeatureSourceIdentity(UPLOAD_ID)).to.equal(3);
    expect(deleteErrors).to.have.been.calledOnceWithExactly(UPLOAD_ID);
    expect(insertErrors).to.have.been.calledOnceWithExactly(UPLOAD_ID);
    expect(deleteErrors).to.have.been.calledBefore(insertErrors);
  });

  it('classifies an upload under the feature-state lock', async () => {
    stubUpload();
    sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'findPredecessorSubmissionUploadId')
      .resolves('predecessor-upload-id');
    const reconcile = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'reconcileSubmissionFeatures')
      .resolves();
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());

    expect(await service.reconcileSubmissionFeatures(UPLOAD_ID)).to.eql({
      predecessorSubmissionUploadId: 'predecessor-upload-id'
    });
    expect(reconcile).to.have.been.calledWith(UPLOAD_ID, 9, 'predecessor-upload-id');
  });

  it('activates the stored reconciliation during approval', async () => {
    stubUpload();
    const getCounts = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'getSubmissionFeatureReconciliationCounts')
      .resolves({ new: 1, modified: 1, unmodified: 1 });
    const link = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'linkReconciledSubmissionFeaturePredecessors')
      .resolves(2);
    const activate = sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'activateReconciledSubmissionFeatures')
      .resolves(3);
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());

    expect(await service.activateSubmissionUploadReconciliation(UPLOAD_ID)).to.eql({
      new: 1,
      modified: 1,
      unmodified: 1
    });
    expect(getCounts).to.have.been.calledBefore(link);
    expect(link).to.have.been.calledBefore(activate);
    expect(activate).to.have.been.calledWith(UPLOAD_ID, 9);
  });

  it('rejects publication when activation count diverges from reconciliation', async () => {
    stubUpload();
    sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'getSubmissionFeatureReconciliationCounts')
      .resolves({ new: 1, modified: 1, unmodified: 1 });
    sinon
      .stub(SubmissionFeatureReconciliationRepository.prototype, 'linkReconciledSubmissionFeaturePredecessors')
      .resolves(2);
    sinon.stub(SubmissionFeatureReconciliationRepository.prototype, 'activateReconciledSubmissionFeatures').resolves(2);

    try {
      await new SubmissionUploadReconciliationService(getMockDBConnection()).activateSubmissionUploadReconciliation(
        UPLOAD_ID
      );
      expect.fail('Expected lifecycle count assertion to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('Applied feature lifecycle counts diverged from reconciliation');
    }
  });
});
