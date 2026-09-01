import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureRepository } from './submission-feature-repository';

describe('SubmissionFeatureRepository reconciliation operations', () => {
  afterEach(() => sinon.restore());

  it('inserts pending submission features from changed upload rows', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 2 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.insertPendingSubmissionFeaturesForSubmissionUploadId('upload-id')).to.eql({ count: 2 });
    expect(sql.firstCall.args[0].text).to.include('INSERT INTO submission_feature');
    expect(sql.firstCall.args[0].text).to.include('upload.submission_id');
    expect(sql.firstCall.args[0].text).to.include('submission_upload_feature_id');
    expect(sql.firstCall.args[0].text).to.include('staged.submission_upload_feature_id');
  });

  it('deactivates active versions replaced by any changed feature', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 1 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.deactivateReplacedSubmissionFeaturesForSubmissionUploadId('upload-id')).to.eql({
      count: 1
    });
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('feature.feature_type_id = changed.feature_type_id');
    expect(text).to.include('feature.submission_id = changed.submission_id');
    expect(text).to.include('feature.submission_upload_id <> changed.submission_upload_id');
    expect(text).to.include('feature.source_id = changed.source_id');
    expect(text).to.not.include('parent_submission_feature_id');
    expect(text).to.include("staged.reconciliation IN ('new', 'superseded')");
    expect(text).to.include('feature.record_effective_date <= now()');
    expect(text).to.include('(feature.record_end_date IS NULL OR now() < feature.record_end_date)');
  });

  it('activates pending or previously ended promoted submission features', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.activateSubmissionFeaturesForSubmissionUploadId('upload-id')).to.eql({ count: 3 });
    expect(sql.firstCall.args[0].text).to.include(
      'feature.submission_upload_feature_id = staged.submission_upload_feature_id'
    );
    expect(sql.firstCall.args[0].text).to.include('COALESCE(feature.record_effective_date, now())');
    expect(sql.firstCall.args[0].text).to.include('OR feature.record_effective_date <= now()');
  });

  it('counts pending features by the retained upload feature key', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getPendingSubmissionFeatureCountForSubmissionUploadId('upload-id')).to.eql({ count: 3 });
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('feature.submission_upload_feature_id = staged.submission_upload_feature_id');
  });

  it('revokes active upload features and restores predecessors by reconciliation key', async () => {
    const result = { revokedFeatureCount: 2, restoredFeatureCount: 1 };
    const sql = sinon.stub().resolves(mockQueryResult([result], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.revokeSubmissionFeaturesForSubmissionUploadId('upload-id')).to.eql(result);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('feature.submission_upload_id =');
    expect(text).to.include('RETURNING');
    expect(text).to.include('predecessor.submission_id = revoked.submission_id');
    expect(text).to.include('predecessor.feature_type_id = revoked.feature_type_id');
    expect(text).to.include('predecessor.source_id = revoked.source_id');
    expect(text).to.include(") = 'approved'");
    expect(text).to.not.include('COALESCE((\n            SELECT status::text');
    expect(text).to.include('predecessor.record_end_date DESC');
    expect(text).to.include('SET record_end_date = NULL');
    expect(text).to.include('feature.record_effective_date <= now()');
    expect(text).to.include('(feature.record_end_date IS NULL OR now() < feature.record_end_date)');
    expect(text).to.not.include('submission_upload_feature staged');
    expect(text).to.not.include('reconciliation');
    expect(text).to.not.include('parent_submission_feature_id');
  });
});
