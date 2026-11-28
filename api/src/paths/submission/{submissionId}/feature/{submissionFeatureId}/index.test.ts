import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../__mocks__/operation';
import * as db from '../../../../../database/db';
import { ApiNotFoundError } from '../../../../../errors/api-error';
import { SubmissionFeature } from '../../../../../repositories/submission-repository';
import { authorizationDependencies } from '../../../../../request-handlers/security/authorization';
import { SubmissionFeatureService } from '../../../../../services/submission-feature-service';

chai.use(sinonChai);

describe('GET /api/submission/{submissionId}/feature/{submissionFeatureId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("authorizes the submission's team and a policy grant on the feature in that submission", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [
        { discriminator: 'Team', entity: 'submission', submissionId: 7 },
        { discriminator: 'SubmissionFeatureGrant', submissionId: 7, submissionFeatureId: 20 }
      ]
    });
    expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });

  it("returns the submission's feature at any lifecycle stage, including its successor", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const feature = { submission_feature_id: 20, submission_id: 7, successor_submission_feature_id: 21 };
    const readStub = sinon
      .stub(SubmissionFeatureService.prototype, 'getSubmissionFeatureBySubmissionId')
      .resolves(feature as unknown as SubmissionFeature);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await index.getSubmissionFeatureBySubmissionId()(mockReq, mockRes, mockNext);

    expect(readStub).to.have.been.calledOnceWith(7, 20);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ feature });
  });

  it('rolls back and rethrows when the submission has no such feature', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const rollback = sinon.spy(connection, 'rollback');
    sinon
      .stub(SubmissionFeatureService.prototype, 'getSubmissionFeatureBySubmissionId')
      .rejects(new ApiNotFoundError('Submission feature not found'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionFeatureId: '99' };

    try {
      await index.getSubmissionFeatureBySubmissionId()(mockReq, mockRes, mockNext);
      expect.fail('Expected ApiNotFoundError');
    } catch (error_) {
      expect(error_).to.be.instanceOf(ApiNotFoundError);
    }

    expect(rollback).to.have.been.calledOnce;
  });
});
