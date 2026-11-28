import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { MartinTokenService } from '../../../../../../services/martin-token-service';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../services/submission-feature-property-geometry-service';

chai.use(sinonChai);

describe('POST /api/submission/{submissionId}/feature/{submissionFeatureId}/tile', () => {
  afterEach(() => {
    sinon.restore();
  });

  it("authorizes the submission's team and a policy grant on the feature in that submission", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const authorizeHandler = (index.POST as unknown as RequestHandler[])[1];
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await authorizeHandler(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [
        { discriminator: 'Team', entity: 'submission', submissionId: 7 },
        { discriminator: 'SubmissionFeatureGrant', submissionId: 7, submissionFeatureId: 20 }
      ]
    });
    expect(index.POST.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });

  it('scopes the token to the submission and feature in the path', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const extentStub = sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 1 });
    const mintTokenStub = sinon
      .stub(MartinTokenService.prototype, 'mintToken')
      .returns({ token: 'a.tile.token', expiresIn: 900, jti: 'jti-1' });
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/feature/{z}/{x}/{y}');

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await index.createSubmissionFeatureTileSession()(mockReq, mockRes, mockNext);

    expect(extentStub).to.have.been.calledOnceWith(7, 20);
    expect(mintTokenStub).to.have.been.calledOnceWith(sinon.match({ ctx: 'sf:7:20' }));
    expect(mockRes.jsonValue.has_spatial_properties).to.be.true;
  });

  it('issues no token when the feature has nothing published to draw', async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: null, geometry_count: 0 });
    const mintTokenStub = sinon.stub(MartinTokenService.prototype, 'mintToken');

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '7', submissionFeatureId: '20' };

    await index.createSubmissionFeatureTileSession()(mockReq, mockRes, mockNext);

    expect(mockRes.jsonValue).to.eql({ has_spatial_properties: false });
    expect(mintTokenStub).not.to.have.been.called;
  });
});
