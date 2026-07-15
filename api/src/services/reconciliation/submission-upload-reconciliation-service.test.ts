import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP409 } from '../../errors/http-error';
import { ReconciliationCounts } from '../../models/reconciliation';
import { SubmissionUploadFeatureRepository } from '../../repositories/reconciliation/submission-upload-feature-repository';
import { SubmissionUploadReconciliationRepository } from '../../repositories/reconciliation/submission-upload-reconciliation-repository';
import { SubmissionFeatureErrorRepository } from '../../repositories/submission-feature-error-repository';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { SubmissionUploadReconciliationService } from './submission-upload-reconciliation-service';

chai.use(sinonChai);

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const COUNTS: ReconciliationCounts = { new: 1, unchanged: 0, superseded: 2, conflict: 0 };

function stubIndexedUpload() {
  return sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUpload').resolves({
    submission_upload_id: UPLOAD_ID,
    submission_id: 9,
    upload_id: '660e8400-e29b-41d4-a716-446655440000',
    team_id: '880e8400-e29b-41d4-a716-446655440000',
    ticket_id: '770e8400-e29b-41d4-a716-446655440000',
    blueprint_id: 1,
    status: 'indexed'
  });
}

describe('SubmissionUploadReconciliationService', () => {
  beforeEach(() => {
    sinon
      .stub(SubmissionUploadFeatureRepository.prototype, 'isSubmissionUploadFeaturesStale')
      .resolves({ stale: false });
  });

  afterEach(() => sinon.restore());

  it('returns reconciliation counts from the repository summary row', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: COUNTS });

    expect(await service.getSubmissionUploadReconciliationCountsForSubmissionUploadId(UPLOAD_ID)).to.eql(COUNTS);
  });

  it('returns null before reconciliation has run', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: null });

    expect(await service.getSubmissionUploadReconciliationCountsForSubmissionUploadId(UPLOAD_ID)).to.be.null;
  });

  it('classifies staging and persists one complete reconciliation summary', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    sinon
      .stub(SubmissionUploadFeatureRepository.prototype, 'updateSubmissionUploadFeaturesWithReconciliation')
      .resolves({ reconciliation: { new: 2, unchanged: 3, superseded: 1, conflict: 0 } });
    sinon
      .stub(SubmissionFeatureErrorRepository.prototype, 'deleteSubmissionFeatureErrorsForSubmissionUploadId')
      .resolves();
    sinon
      .stub(SubmissionFeatureErrorRepository.prototype, 'insertSubmissionFeatureErrorForSubmissionUploadId')
      .resolves();

    const result = await service.reconcileSubmissionUploadFeatures(UPLOAD_ID);

    expect(result).to.eql({ new: 2, unchanged: 3, superseded: 1, conflict: 0 });
  });

  it('promotes only conflict-free reconciliations', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: { new: 2, unchanged: 0, superseded: 0, conflict: 0 } });
    const promote = sinon
      .stub(SubmissionFeatureRepository.prototype, 'insertPendingSubmissionFeaturesForSubmissionUploadId')
      .resolves({ count: 2 });
    sinon
      .stub(SubmissionFeatureRepository.prototype, 'getPendingSubmissionFeatureCountForSubmissionUploadId')
      .resolves({ count: 2 });

    expect(await service.promoteSubmissionUploadFeatures(UPLOAD_ID)).to.equal(2);
    expect(promote).to.have.been.calledOnceWith(UPLOAD_ID);
  });

  it('rejects promotion when reconciliation contains a conflict', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: { new: 0, unchanged: 0, superseded: 0, conflict: 1 } });

    try {
      await service.promoteSubmissionUploadFeatures(UPLOAD_ID);
      expect.fail('Expected conflict');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }
  });

  it('does not gate activation on the upload processing status', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    sinon.stub(SubmissionUploadRepository.prototype, 'getSubmissionUpload').resolves({
      submission_upload_id: UPLOAD_ID,
      submission_id: 9,
      upload_id: '660e8400-e29b-41d4-a716-446655440000',
      team_id: '880e8400-e29b-41d4-a716-446655440000',
      ticket_id: '770e8400-e29b-41d4-a716-446655440000',
      blueprint_id: 1,
      status: 'promoted'
    });
    const lock = sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: { new: 0, unchanged: 1, superseded: 0, conflict: 0 } });

    expect(await service.activateSubmissionUploadReconciliation(UPLOAD_ID)).to.eql({
      new: 0,
      unchanged: 1,
      superseded: 0,
      conflict: 0
    });
    expect(lock).to.have.been.calledOnceWith(9);
  });

  it('does not mutate feature state for an unchanged-only reconciliation', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: { new: 0, unchanged: 2, superseded: 0, conflict: 0 } });
    const deactivate = sinon.stub(
      SubmissionFeatureRepository.prototype,
      'deactivateReplacedSubmissionFeaturesForSubmissionUploadId'
    );

    expect(await service.activateSubmissionUploadReconciliation(UPLOAD_ID)).to.eql({
      new: 0,
      unchanged: 2,
      superseded: 0,
      conflict: 0
    });
    expect(deactivate).not.to.have.been.called;
  });

  it('rejects approval when an unchanged reconciliation is stale', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    const stale = SubmissionUploadFeatureRepository.prototype.isSubmissionUploadFeaturesStale as sinon.SinonStub;
    stale.resolves({ stale: true });

    try {
      await service.activateSubmissionUploadReconciliation(UPLOAD_ID);
      expect.fail('Expected stale reconciliation rejection');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }
  });

  it('activates changed features without synchronously rebuilding closure', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    sinon
      .stub(SubmissionUploadReconciliationRepository.prototype, 'getSubmissionUploadReconciliationCounts')
      .resolves({ reconciliation: COUNTS });
    sinon
      .stub(SubmissionFeatureRepository.prototype, 'deactivateReplacedSubmissionFeaturesForSubmissionUploadId')
      .resolves({ count: 2 });
    sinon
      .stub(SubmissionFeatureRepository.prototype, 'activateSubmissionFeaturesForSubmissionUploadId')
      .resolves({ count: 3 });

    expect(await service.activateSubmissionUploadReconciliation(UPLOAD_ID)).to.eql(COUNTS);
  });

  it('revokes owned features and restores predecessors without synchronously rebuilding closure', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    const revoke = sinon
      .stub(SubmissionFeatureRepository.prototype, 'revokeSubmissionFeaturesForSubmissionUploadId')
      .resolves({ revokedFeatureCount: 2, restoredFeatureCount: 2 });
    await service.revokeSubmissionUploadReconciliation(UPLOAD_ID);

    expect(revoke).to.have.been.calledOnceWith(UPLOAD_ID);
  });

  it('does nothing when the revoked upload no longer owns active features', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    stubIndexedUpload();
    sinon.stub(SubmissionRepository.prototype, 'lockSubmissionFeatureStateForSubmissionId').resolves();
    const revoke = sinon
      .stub(SubmissionFeatureRepository.prototype, 'revokeSubmissionFeaturesForSubmissionUploadId')
      .resolves({ revokedFeatureCount: 0, restoredFeatureCount: 0 });
    await service.revokeSubmissionUploadReconciliation(UPLOAD_ID);

    expect(revoke).to.have.been.calledOnceWith(UPLOAD_ID);
  });
});
