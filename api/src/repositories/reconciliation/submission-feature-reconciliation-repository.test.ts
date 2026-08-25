import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { SubmissionFeatureReconciliationRepository } from './submission-feature-reconciliation-repository';

describe('SubmissionFeatureReconciliationRepository', () => {
  afterEach(() => sinon.restore());

  it('deletes existing source identity errors', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 2));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    await repository.deleteSourceIdentityErrors('upload-id');

    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('DELETE FROM submission_feature_error');
    expect(text).to.include('MISSING_FEATURE_SOURCE_ID');
    expect(text).to.include('DUPLICATE_FEATURE_SOURCE_ID');
  });

  it('inserts source identity errors and returns the invalid feature occurrence count', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.insertSourceIdentityErrors('upload-id')).to.equal(3);
    const text = sql.firstCall.args[0].text as string;
    expect(text).not.to.include('DELETE FROM submission_feature_error');
    expect(text).to.include('MISSING_FEATURE_SOURCE_ID');
    expect(text).to.include('DUPLICATE_FEATURE_SOURCE_ID');
    expect(text).to.include('missing AS');
    expect(text).to.include('duplicates AS');
    expect(text).to.include("NULLIF(btrim(source_id), '') IS NULL");
    expect(text).to.include("NULLIF(btrim(source_id), '') IS NOT NULL");
    expect(text).to.include('GROUP BY source_id');
  });

  it('resolves and locks the direct upload predecessor recorded at creation', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ submission_upload_id: 'predecessor-upload-id' }], 1));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.findPredecessorSubmissionUploadId('upload-id', 9)).to.equal('predecessor-upload-id');
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('candidate.successor_submission_upload_id =');
    expect(text).to.include('FOR UPDATE OF candidate');
    expect(text).to.not.include('submission_upload_status');
    expect(text).to.not.include("candidate.status = 'indexed'");
    expect(text).to.not.include('candidate.record_end_date IS NULL');
  });

  it('returns null when no direct upload predecessor exists', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 0));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.findPredecessorSubmissionUploadId('upload-id', 9)).to.be.null;
  });

  it('classifies by submission and source id against the pending predecessor before published state', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 3));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    await repository.reconcileSubmissionFeatures('upload-id', 9, 'predecessor-upload-id');
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('candidate.source_id = incoming.source_id');
    expect(text).to.not.include('candidate.feature_type_id');
    expect(text).to.include('candidate.record_effective_date <= now()');
    expect(text).to.include('candidate.successor_submission_feature_id IS NULL');
    expect(text).to.include("THEN 'unmodified'");
    expect(text).to.include('UPDATE submission_feature incoming');
  });

  it('links direct predecessors', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 2));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.linkReconciledSubmissionFeaturePredecessors('upload-id', 9)).to.equal(2);
    const linkText = sql.firstCall.args[0].text as string;
    expect(linkText).to.include('successor_submission_feature_id = incoming.submission_feature_id');
    expect(linkText).to.include('incoming.reconciliation IS NOT NULL');
  });

  it('activates every reconciliation outcome', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 3));
    const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql }));

    expect(await repository.activateReconciledSubmissionFeatures('upload-id', 9)).to.equal(3);
    const activateText = sql.firstCall.args[0].text as string;
    expect(activateText).to.include('reconciliation IS NOT NULL');
  });
});
