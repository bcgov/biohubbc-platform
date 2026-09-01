import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SubmissionUploadFeatureService } from './submission-upload-feature-service';

chai.use(sinonChai);

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';
const SUBMISSION_UPLOAD_FEATURE_ID = '7d1e2b8e-7125-4ce5-83d5-7f55dc6df9a1';
const FEATURE = {
  submission_upload_feature_id: SUBMISSION_UPLOAD_FEATURE_ID,
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  source_id: 'feature-1',
  submission_feature_id: null,
  feature_type_id: 3,
  data: { id: 'feature-1' },
  data_byte_size: 100,
  content_hash: 'a'.repeat(64),
  universal_id: null,
  reconciliation: null,
  metadata: null
};

describe('SubmissionUploadFeatureService', () => {
  afterEach(() => sinon.restore());

  it('delegates core table operations to the submission upload staging feature repository', async () => {
    const service = new SubmissionUploadFeatureService(getMockDBConnection());
    const insert = sinon
      .stub(service.submissionUploadFeatureRepository, 'insertSubmissionUploadFeature')
      .resolves(FEATURE);
    const getOne = sinon
      .stub(service.submissionUploadFeatureRepository, 'getSubmissionUploadFeature')
      .resolves(FEATURE);
    const getMany = sinon
      .stub(service.submissionUploadFeatureRepository, 'getSubmissionUploadFeaturesForSubmissionUploadId')
      .resolves([FEATURE]);
    const update = sinon
      .stub(service.submissionUploadFeatureRepository, 'updateSubmissionUploadFeature')
      .resolves(FEATURE);
    const createData = {
      submission_upload_id: FEATURE.submission_upload_id,
      source_id: FEATURE.source_id,
      feature_type_id: FEATURE.feature_type_id,
      data: FEATURE.data,
      data_byte_size: FEATURE.data_byte_size,
      content_hash: FEATURE.content_hash,
      universal_id: FEATURE.universal_id
    };

    expect(await service.insertSubmissionUploadFeature(createData)).to.eql(FEATURE);
    expect(await service.getSubmissionUploadFeature(SUBMISSION_UPLOAD_FEATURE_ID)).to.eql(FEATURE);
    expect(await service.getSubmissionUploadFeaturesForSubmissionUploadId(SUBMISSION_UPLOAD_ID)).to.eql([FEATURE]);
    expect(await service.updateSubmissionUploadFeature(SUBMISSION_UPLOAD_FEATURE_ID, { reconciliation: null })).to.eql(
      FEATURE
    );
    expect(insert).to.have.been.calledOnceWith(createData);
    expect(getOne).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_FEATURE_ID);
    expect(getMany).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID);
    expect(update).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_FEATURE_ID, { reconciliation: null });
  });
});
