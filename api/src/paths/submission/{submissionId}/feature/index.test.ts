import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getOperationHandler } from '../../../../__mocks__/operation';
import * as db from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { SubmissionFeatureForReview } from '../../../../models/submission';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
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

    expect(featuresStub).to.have.been.calledOnceWith(1, 1000, sinon.match({ page: 2, limit: 10 }));
    expect(countStub).to.have.been.calledOnceWith(1, 1000);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue.features).to.eql(features);
  });
});

describe('GET authorization', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("authorizes only the submission's team", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7' };

    await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Team', entity: 'submission', submissionId: 7 }]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('rejects users outside the submission team before loading features', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const featuresStub = sinon.stub(SubmissionService.prototype, 'getSubmissionFeatures');
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7' };

    try {
      await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }

    expect(mockNext).not.to.have.been.called;
    expect(featuresStub).not.to.have.been.called;
  });

  it('documents bearer authentication only, with no anonymous access', () => {
    expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });
});
