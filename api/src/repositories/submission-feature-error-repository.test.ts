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
    expect(sql.firstCall.args[0].text).to.include('INSERT INTO submission_feature_error');
  });
});
