import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { isSubmissionFeatureCurrent, isSubmissionFeaturePublished } from './sql-fragments';
import { SubmissionFeatureRepository } from './submission-feature-repository';

describe('SubmissionFeatureRepository feature lookup', () => {
  afterEach(() => sinon.restore());

  it('scopes a review feature by submission, upload, and feature IDs without requiring publication', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{}], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    await repository.getSubmissionUploadFeature(16, '11111111-1111-4111-8111-111111111111', 12);

    const statement = sql.firstCall.args[0];
    expect(statement.text).to.include('sf.submission_feature_id =');
    expect(statement.text).to.include('sf.submission_id =');
    expect(statement.text).to.include('sf.submission_upload_id =');
    expect(statement.text).to.include('sf.create_date');
    expect(statement.text).to.include('sf.successor_submission_feature_id');
    expect(statement.text).to.include('c.client_id AS contributor_name');
    expect(statement.text).to.include('c.contributor_id = s.contributor_id');
    expect(statement.text).not.to.include('sf.record_effective_date');
    expect(statement.text).to.include('terminal.terminal_submission_feature_id');
    expect(statement.text).to.include('parent.submission_upload_id = sf.submission_upload_id');
    expect(statement.text).to.include('sfs.record_effective_date <= now()');
    expect(statement.values).to.eql([12, 16, '11111111-1111-4111-8111-111111111111']);
  });

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

describe('SubmissionFeatureRepository.getSubmissionFeatureBySubmissionId', () => {
  const row = {
    submission_feature_id: 20,
    uuid: '11111111-1111-1111-1111-111111111111',
    urn: 'urn:7:observation:20',
    create_date: '2026-01-01',
    submission_id: 7,
    feature_type_id: 3,
    source_id: null,
    successor_submission_feature_id: null,
    terminal_submission_feature_id: null,
    feature_type_name: 'observation',
    contributor_name: 'contributor',
    secured: false,
    security_reasons: []
  };

  it('reads the feature within the submission at any lifecycle stage', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([row], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionFeatureBySubmissionId(7, 20)).to.eql(row);

    const { text, values } = sql.firstCall.args[0];
    expect(text).to.include('LEFT JOIN LATERAL');
    expect(text).to.include('sf.submission_id =');
    expect(text).not.to.include(isSubmissionFeaturePublished('sf') + ';');
    expect(values).to.include.members([20, 7]);
  });

  it('throws not found when the submission has no such feature', async () => {
    const repository = new SubmissionFeatureRepository(
      getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 0)) })
    );

    try {
      await repository.getSubmissionFeatureBySubmissionId(7, 99);
      expect.fail('Expected not found');
    } catch (error_) {
      expect((error_ as Error).message).to.equal('Submission feature not found');
    }
  });

  it('keeps the public read limited to published features that resolve to a current feature', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([row], 1));
    const repository = new SubmissionFeatureRepository(getMockDBConnection({ sql }));

    await repository.getSubmissionFeatureById(20);

    const { text } = sql.firstCall.args[0];
    expect(text).not.to.include('LEFT JOIN LATERAL');
    expect(text).to.include(`AND ${isSubmissionFeaturePublished('sf')};`);
  });
});
