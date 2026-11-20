import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissionUploadFeature } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import { SubmissionFeature } from '../../../../../../../../repositories/submission-repository';
import { SubmissionFeatureService } from '../../../../../../../../services/submission-feature-service';

chai.use(sinonChai);

describe('getSubmissionUploadFeature', () => {
  afterEach(() => sinon.restore());

  it('returns a feature scoped to the submission upload', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const feature: SubmissionFeature = {
      submission_feature_id: 12,
      uuid: '11111111-1111-4111-8111-111111111111',
      urn: 'urn:feature:12',
      create_date: '2026-01-01T00:00:00.000Z',
      submission_id: 16,
      feature_type_id: 3,
      source_id: null,
      successor_submission_feature_id: null,
      terminal_submission_feature_id: null,
      feature_type_name: 'animal',
      submission_name: 'Test submission',
      contributor_name: 'Test contributor',
      secured: false,
      security_reasons: []
    };
    const getFeature = sinon.stub(SubmissionFeatureService.prototype, 'getSubmissionUploadFeature').resolves(feature);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '22222222-2222-4222-8222-222222222222',
      submissionFeatureId: '12'
    };

    await getSubmissionUploadFeature()(mockReq, mockRes, () => {});

    expect(getFeature).to.have.been.calledWith(16, mockReq.params.submissionUploadId, 12);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ feature });
  });
});
