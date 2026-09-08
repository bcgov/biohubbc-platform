import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { SubmissionService } from '../../../../../../../services/submission-service';

chai.use(sinonChai);

describe('getSubmissionUploadFeatures', () => {
  afterEach(() => sinon.restore());

  it('returns paginated features for the requested submission upload', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'release').resolves();

    const features = [
      { submission_id: 16, submission_feature_id: 2, feature_type_name: 'animal', feature_type_id: 3, secured: false }
    ];
    const getFeatures = sinon.stub(SubmissionService.prototype, 'getSubmissionUploadFeatures').resolves(features);
    sinon.stub(SubmissionService.prototype, 'getSubmissionUploadFeaturesCount').resolves(1);

    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: '11111111-1111-4111-8111-111111111111'
    };

    await index.getSubmissionUploadFeatures()(mockReq, mockRes, () => {});

    expect(getFeatures).to.have.been.calledWith(mockReq.params.submissionUploadId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.features).to.eql(features);
    expect(mockRes.jsonValue.pagination.total).to.equal(1);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
