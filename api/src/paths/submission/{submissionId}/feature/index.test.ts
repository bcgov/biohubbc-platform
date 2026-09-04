import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { SubmissionFeatureForReview } from '../../../../models/submission';
import { SubmissionService } from '../../../../services/submission-service';
import { UserService } from '../../../../services/user-service';

chai.use(sinonChai);

describe('getSubmissionFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('passes the active system user ID and pagination to the service', async () => {
    const connection = getMockDBConnection({ systemUserId: () => 1000 });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(UserService.prototype, 'getUserById').resolves({} as never);

    const features: SubmissionFeatureForReview[] = [
      {
        submission_id: 1,
        submission_feature_id: 2,
        feature_type_name: 'observation',
        feature_type_id: 3,
        secured: true
      }
    ];
    const featuresStub = sinon.stub(SubmissionService.prototype, 'getSubmissionFeatures').resolves(features);
    const countStub = sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturesCount').resolves(1);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '1' };
    mockReq.query = { page: '2', limit: '10' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(featuresStub).to.have.been.calledOnceWith(1, sinon.match({ page: 2, limit: 10 }), 1000);
    expect(countStub).to.have.been.calledOnceWith(1, 1000);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.features).to.eql(features);
  });

  it('uses the API system user security context for an anonymous request', async () => {
    const connection = getMockDBConnection({ systemUserId: () => 2 });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(UserService.prototype, 'getUserById').resolves({} as never);
    const featuresStub = sinon.stub(SubmissionService.prototype, 'getSubmissionFeatures').resolves([]);
    sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturesCount').resolves(0);

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '1' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(featuresStub).to.have.been.calledOnceWith(1, sinon.match.object, 2);
  });
});
