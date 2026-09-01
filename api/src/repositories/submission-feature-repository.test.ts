import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureRepository } from './submission-feature-repository';

describe('SubmissionFeatureRepository active feature lookup', () => {
  afterEach(() => sinon.restore());

  it('counts every upload-owned feature that has ever been activated', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 2 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(
      await repository.getActivatedSubmissionFeatureCountBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000')
    ).to.equal(2);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('record_effective_date IS NOT NULL');
    expect(text).to.not.include('record_end_date IS NULL');
  });

  it('counts every activated feature across a submission', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getActivatedSubmissionFeatureCountBySubmissionId(9)).to.equal(3);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('sf.submission_id =');
    expect(text).to.include('JOIN submission_upload');
    expect(text).to.include('su.record_end_date IS NULL');
  });
});
