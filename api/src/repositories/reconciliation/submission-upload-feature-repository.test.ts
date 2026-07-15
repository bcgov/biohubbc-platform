import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiNotFoundError } from '../../errors/api-error';
import { SubmissionUploadFeatureRepository } from './submission-upload-feature-repository';

chai.use(sinonChai);

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const SUBMISSION_UPLOAD_FEATURE_ID = '7d1e2b8e-7125-4ce5-83d5-7f55dc6df9a1';
const FEATURE = {
  submission_upload_feature_id: SUBMISSION_UPLOAD_FEATURE_ID,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  source_id: 'feature-1',
  feature_type_id: 3,
  data: { id: 'feature-1' },
  data_byte_size: 100,
  content_hash: 'a'.repeat(64),
  universal_id: null,
  reconciliation: null,
  metadata: null
};

describe('SubmissionUploadFeatureRepository', () => {
  afterEach(() => sinon.restore());

  it('patches every staging row and persists the complete reconciliation summary', async () => {
    const result = { reconciliation: { new: 2, unchanged: 0, superseded: 0, conflict: 1 } };
    const sql = sinon.stub().resolves(mockQueryResult([result], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ sql }));
    expect(await repository.updateSubmissionUploadFeaturesWithReconciliation(SUBMISSION_UPLOAD_ID, 42)).to.eql(result);
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include('UPDATE submission_upload_feature staged');
    expect(text).to.include('INSERT INTO submission_upload_reconciliation');
    expect(text).to.include('ON CONFLICT (submission_upload_id, reconciliation)');
    expect(text).to.include('jsonb_build_object');
    expect(text).to.include("COALESCE(MAX(persisted.count) FILTER (WHERE persisted.reconciliation = 'conflict'), 0)");
    expect(text).to.include('SELECT DISTINCT ON (feature.feature_type_id, feature.source_id)');
    expect(text).to.include('(feature.content_hash IS NOT NULL) DESC');
    expect(text).to.include("incoming.incoming_count > 1 THEN 'conflict'");
    expect(text).to.include('baseline.content_hash IS NOT NULL');
  });

  it('detects unchanged rows whose active baseline has changed since reconciliation', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([{ stale: true }], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.isSubmissionUploadFeaturesStale(SUBMISSION_UPLOAD_ID)).to.eql({ stale: true });
    const text = sql.firstCall.args[0].text as string;
    expect(text).to.include("staged.reconciliation = 'unchanged'");
    expect(text).to.include('JOIN submission_upload upload');
    expect(text).to.include('active_feature.record_effective_date <= now()');
    expect(text).to.include('(active_feature.record_end_date IS NULL OR now() < active_feature.record_end_date)');
    expect(text).to.include('active_feature.content_hash IS DISTINCT FROM staged.content_hash');
  });

  it('gets one submission upload staging feature by id', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([FEATURE], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionUploadFeature(SUBMISSION_UPLOAD_FEATURE_ID)).to.eql(FEATURE);
    expect(sql).to.have.been.calledOnce;
  });

  it('throws when a submission upload staging feature does not exist', async () => {
    const repository = new SubmissionUploadFeatureRepository(
      getMockDBConnection({ sql: sinon.stub().resolves(mockQueryResult([], 0)) })
    );

    try {
      await repository.getSubmissionUploadFeature('8e741452-7326-4a2e-b617-9dc6f1bf6bb2');
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiNotFoundError);
    }
  });

  it('gets submission upload staging features for an upload', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([FEATURE], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ sql }));

    expect(await repository.getSubmissionUploadFeaturesForSubmissionUploadId(SUBMISSION_UPLOAD_ID)).to.eql([FEATURE]);
    expect(sql).to.have.been.calledOnce;
  });

  it('updates only derived reconciliation fields', async () => {
    const reconciledFeature = { ...FEATURE, reconciliation: 'new' as const };
    const knex = sinon.stub().resolves(mockQueryResult([reconciledFeature], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ knex }));

    expect(
      await repository.updateSubmissionUploadFeature(SUBMISSION_UPLOAD_FEATURE_ID, {
        reconciliation: 'new',
        metadata: undefined
      })
    ).to.eql(reconciledFeature);
    expect(knex).to.have.been.calledOnce;

    const query = knex.firstCall.args[0].toSQL();
    expect(query.sql).to.include('update "submission_upload_feature"');
    expect(query.sql).to.include('"reconciliation" = ?');
    expect(query.sql).not.to.include('"metadata" = ?');
  });
});
