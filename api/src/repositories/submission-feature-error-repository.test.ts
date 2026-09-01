import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureErrorRepository } from './submission-feature-error-repository';

describe('SubmissionFeatureErrorRepository', () => {
  afterEach(() => sinon.restore());

  it('deletes reconciliation errors for an upload', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 1));
    const repository = new SubmissionFeatureErrorRepository(getMockDBConnection({ sql }));

    await repository.deleteSubmissionFeatureErrorsForSubmissionUploadId('upload-id');
    expect(sql.firstCall.args[0].text).to.include('DELETE FROM submission_feature_error');
  });

  it('inserts a reconciliation conflict error', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([], 1));
    const repository = new SubmissionFeatureErrorRepository(getMockDBConnection({ sql }));

    await repository.insertSubmissionFeatureErrorForSubmissionUploadId('upload-id');
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('deleted_errors AS');
    expect(text).to.include('conflict_rows AS');
    expect(text).to.include("error_code IN ('RECONCILIATION_CONFLICT', 'DUPLICATE_FEATURE_SOURCE_ID')");
    expect(text).to.include('RECONCILIATION_CONFLICT');
    expect(text).to.include('DUPLICATE_FEATURE_SOURCE_ID');
    expect(text).to.include("staged.metadata->>'reason' AS reason");
    expect(text).to.include("WHERE reason = 'duplicate_source_id'");
    expect(text).to.include('NULL::integer AS feature_type_property_id');
    expect(text).to.include('COUNT(*)::integer AS count');
    expect(text).to.include('AS details');
    expect(text).to.not.include('ON CONFLICT');
  });
});
