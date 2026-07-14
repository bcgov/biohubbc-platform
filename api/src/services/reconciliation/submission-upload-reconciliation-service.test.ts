import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionUploadReconciliationService } from './submission-upload-reconciliation-service';

chai.use(sinonChai);

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECONCILIATION = {
  submission_upload_reconciliation_id: 1,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  reconciliation: 'superseded' as const,
  count: 3
};

describe('SubmissionUploadReconciliationService', () => {
  afterEach(() => sinon.restore());

  it('delegates CRUD operations to the submission upload reconciliation repository', async () => {
    const service = new SubmissionUploadReconciliationService(getMockDBConnection());
    const repository = service.submissionUploadReconciliationRepository;
    const upsert = sinon.stub(repository, 'upsertSubmissionUploadReconciliation').resolves(RECONCILIATION);
    const getOne = sinon.stub(repository, 'getSubmissionUploadReconciliation').resolves(RECONCILIATION);
    const getMany = sinon
      .stub(repository, 'getSubmissionUploadReconciliationsForSubmissionUploadId')
      .resolves([RECONCILIATION]);
    const update = sinon.stub(repository, 'updateSubmissionUploadReconciliation').resolves(RECONCILIATION);
    const remove = sinon.stub(repository, 'deleteSubmissionUploadReconciliation').resolves();
    const createData = { submission_upload_id: SUBMISSION_UPLOAD_ID, reconciliation: 'superseded' as const, count: 3 };

    expect(await service.upsertSubmissionUploadReconciliation(createData)).to.eql(RECONCILIATION);
    expect(await service.getSubmissionUploadReconciliation(1)).to.eql(RECONCILIATION);
    expect(await service.getSubmissionUploadReconciliationsForSubmissionUploadId(SUBMISSION_UPLOAD_ID)).to.eql([
      RECONCILIATION
    ]);
    expect(await service.updateSubmissionUploadReconciliation(1, { count: 3 })).to.eql(RECONCILIATION);
    await service.deleteSubmissionUploadReconciliation(1);
    expect(upsert).to.have.been.calledOnceWith(createData);
    expect(getOne).to.have.been.calledOnceWith(1);
    expect(getMany).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID);
    expect(update).to.have.been.calledOnceWith(1, { count: 3 });
    expect(remove).to.have.been.calledOnceWith(1);
  });
});
