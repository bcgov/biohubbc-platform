import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { SubmissionUploadReconciliationRepository } from './submission-upload-reconciliation-repository';

chai.use(sinonChai);

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const RECONCILIATION = {
  submission_upload_reconciliation_id: 1,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  reconciliation: 'superseded' as const,
  count: 3
};

describe('SubmissionUploadReconciliationRepository', () => {
  afterEach(() => sinon.restore());

  it('upserts one submission upload reconciliation count', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([RECONCILIATION], 1));
    const repository = new SubmissionUploadReconciliationRepository(getMockDBConnection({ sql }));

    expect(
      await repository.upsertSubmissionUploadReconciliation({
        submission_upload_id: SUBMISSION_UPLOAD_ID,
        reconciliation: 'superseded',
        count: 3
      })
    ).to.eql(RECONCILIATION);
    expect(sql).to.have.been.calledOnce;
    expect(sql.firstCall.args[0].text).to.include('ON CONFLICT (submission_upload_id, reconciliation)');
  });

  it('gets one submission upload reconciliation by id', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([RECONCILIATION], 1));
    const repository = new SubmissionUploadReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionUploadReconciliation(1)).to.eql(RECONCILIATION);
    expect(sql).to.have.been.calledOnce;
  });

  it('gets submission upload reconciliation records for an upload', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([RECONCILIATION], 1));
    const repository = new SubmissionUploadReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionUploadReconciliationsForSubmissionUploadId(SUBMISSION_UPLOAD_ID)).to.eql([
      RECONCILIATION
    ]);
    expect(sql).to.have.been.calledOnce;
  });

  it('updates one submission upload reconciliation count', async () => {
    const updated = { ...RECONCILIATION, count: 4 };
    const sql = sinon.stub().resolves(mockQueryResult([updated], 1));
    const repository = new SubmissionUploadReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.updateSubmissionUploadReconciliation(1, { count: 4 })).to.eql(updated);
    expect(sql).to.have.been.calledOnce;
  });

  it('deletes one submission upload reconciliation count', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 1));
    const repository = new SubmissionUploadReconciliationRepository(getMockDBConnection({ sql }));

    await repository.deleteSubmissionUploadReconciliation(1);
    expect(sql).to.have.been.calledOnce;
    expect(sql.firstCall.args[0].text).to.include('DELETE FROM submission_upload_reconciliation');
  });

  it('throws when a submission upload reconciliation does not exist', async () => {
    const repository = new SubmissionUploadReconciliationRepository(
      getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 0)) })
    );

    try {
      await repository.getSubmissionUploadReconciliation(99);
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiNotFoundError);
    }
  });
});
