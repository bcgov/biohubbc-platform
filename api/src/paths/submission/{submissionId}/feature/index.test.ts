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

chai.use(sinonChai);

describe('getSubmissionFeatures', () => {
  afterEach(() => {
    sinon.restore();
  });

  const features: SubmissionFeatureForReview[] = [
    {
      submission_id: 1,
      submission_feature_id: 2,
      feature_type_name: 'observation',
      feature_type_id: 3
    }
  ];
  const pagination = { total: 1, current_page: 2, last_page: 1, per_page: 10, sort: undefined, order: undefined };

  it('returns the current features page for the authenticated user by default', async () => {
    const connection = getMockDBConnection({ systemUserId: () => 1000 });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const pageStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeaturePage')
      .resolves({ features, pagination });

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '1' };
    mockReq.query = { page: '2', limit: '10' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(pageStub).to.have.been.calledOnceWith(
      1,
      1000,
      { lifecycle: 'current' },
      sinon.match({ page: 2, limit: 10 })
    );
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ features, pagination });
  });

  it('passes the requested lifecycle to the service', async () => {
    const connection = getMockDBConnection({ systemUserId: () => 1000 });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const pageStub = sinon
      .stub(SubmissionService.prototype, 'getSubmissionFeaturePage')
      .resolves({ features, pagination });

    const requestHandler = index.getSubmissionFeatures();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '1' };
    mockReq.query = { lifecycle: 'superseded' };

    await requestHandler(mockReq, mockRes, () => {});

    expect(pageStub).to.have.been.calledOnceWith(1, 1000, { lifecycle: 'superseded' }, sinon.match.object);
  });

  it('documents the lifecycle query parameter with current as the default', () => {
    const lifecycle = (index.GET.apiDoc?.parameters as { name: string; schema: unknown }[]).find(
      (parameter) => parameter.name === 'lifecycle'
    );

    expect(lifecycle?.schema).to.eql({ type: 'string', enum: ['current', 'superseded', 'all'], default: 'current' });
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
    const featuresStub = sinon.stub(SubmissionService.prototype, 'getSubmissionFeaturePage');
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
