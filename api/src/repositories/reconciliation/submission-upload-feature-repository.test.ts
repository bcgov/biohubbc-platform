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

  it('inserts one immutable submission upload staging feature', async () => {
    const sql = sinon.stub().resolves(mockQueryResult([FEATURE], 1));
    const repository = new SubmissionUploadFeatureRepository(getMockDBConnection({ sql }));

    const result = await repository.insertSubmissionUploadFeature({
      submission_upload_id: FEATURE.submission_upload_id,
      source_id: FEATURE.source_id,
      feature_type_id: FEATURE.feature_type_id,
      data: FEATURE.data,
      data_byte_size: FEATURE.data_byte_size,
      content_hash: FEATURE.content_hash,
      universal_id: FEATURE.universal_id
    });

    expect(result).to.eql(FEATURE);
    expect(sql).to.have.been.calledOnce;
    expect(sql.firstCall.args[0].text).to.include('INSERT INTO submission_upload_feature');
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
