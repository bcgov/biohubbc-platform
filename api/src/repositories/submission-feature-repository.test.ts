import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { isSubmissionFeatureCurrent, isSubmissionFeaturePublished } from './sql-fragments';
import { SubmissionFeatureRepository } from './submission-feature-repository';

describe('SubmissionFeatureRepository feature lookup', () => {
  afterEach(() => sinon.restore());

  it('counts every upload-owned feature that has ever been published', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 2 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(
      await repository.getActivatedSubmissionFeatureCountBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000')
    ).to.equal(2);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('record_effective_date IS NOT NULL');
    expect(text).to.not.include('record_end_date IS NULL');
  });

  it('counts every published feature across a submission', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ count: 3 }], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getActivatedSubmissionFeatureCountBySubmissionId(9)).to.equal(3);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('sf.submission_id =');
    expect(text).to.include('JOIN submission_upload');
    expect(text).to.include('su.record_end_date IS NULL');
  });

  it('resolves a feature id when it has been published', async () => {
    const row = {
      submission_feature_id: 1,
      uuid: 'uuid',
      urn: 'urn',
      create_date: '2026-01-02T12:00:00.000Z',
      submission_id: 2,
      feature_type_id: 3,
      source_id: 'A',
      feature_type_name: 'survey',
      feature_type_display_name: 'Survey',
      submission_name: 'Submission',
      contributor_name: 'SIMS',
      secured: false,
      security_reasons: []
    };
    const sql = sinon.stub().resolves(mockQueryResult([row], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionFeatureById(1)).to.eql(row);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include(isSubmissionFeaturePublished('sf'));
    expect(text).to.include('WITH RECURSIVE successor_chain');
    expect(text.match(/WITH RECURSIVE successor_chain/g) || []).to.have.lengthOf(1);
    expect(text).to.include('terminal.terminal_submission_feature_id');
    expect(text).to.include('c.client_id as contributor_name');
    expect(text).to.include('c.contributor_id = s.contributor_id');
    expect(text).to.include('successor.submission_id = chain.submission_id');
    expect(text).to.include('WITH RECURSIVE historical_ancestry');
    expect(text).to.include(`NOT (${isSubmissionFeatureCurrent('sf')})`);
    expect(text).to.include('parent.parent_submission_feature_id');
    expect(text).to.not.include('sf.record_end_date <= sfs.record_end_date');
    expect(text).to.not.include('sfs.record_effective_date <= sf.record_end_date');
    expect(text).to.include('sfs.record_effective_date <= now()');
    expect(text).to.include('(sfs.record_end_date IS NULL OR now() < sfs.record_end_date)');
    expect(text).to.not.include('submission_feature sf_sec');
    expect(text).to.not.match(/\bsf\.data\b/);
  });
});
