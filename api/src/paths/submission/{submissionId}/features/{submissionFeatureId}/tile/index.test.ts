import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { HTTP400, HTTPError } from '../../../../../../errors/http-error';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { MartinTokenService } from '../../../../../../services/martin-token-service';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../services/submission-feature-property-geometry-service';

chai.use(sinonChai);

describe('createSubmissionFeatureTileSession', () => {
  afterEach(() => {
    sinon.restore();
  });

  const stubMintToken = () =>
    sinon.stub(MartinTokenService.prototype, 'mintToken').returns({
      token: 'a.tile.token',
      expiresIn: 900,
      jti: 'jti-1'
    });

  it('returns a session scoped to the requested feature', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    sinon.stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent').resolves({
      bbox: [-125.1, 49.1, -125.0, 49.2],
      geometry_count: 3
    });

    const mintTokenStub = stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/feature/{z}/{x}/{y}');

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql({
      has_spatial_properties: true,
      token: 'a.tile.token',
      token_type: 'Bearer',
      token_expires_in: 900,
      source: 'feature',
      source_layer: 'geometries',
      martin_url_template: '/martin/feature/{z}/{x}/{y}',
      bbox: [-125.1, 49.1, -125.0, 49.2],
      min_zoom: 0,
      max_zoom: 15
    });
    expect(mintTokenStub).to.have.been.calledOnce;
  });

  it('scopes the token to the identifiers the route authorized', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const getActiveGeometryExtentStub = sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 1 });

    const mintTokenStub = stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/feature/{z}/{x}/{y}');

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await requestHandler(mockReq, mockRes, mockNext);

    // The claim is built from the path parameters the authorization rule checked, so a caller cannot
    // name one feature to be authorized and receive a token for another.
    expect(mintTokenStub).to.have.been.calledOnceWith({ source: 'feature', ctx: 'sf:12:34' });
    expect(getActiveGeometryExtentStub).to.have.been.calledOnceWith(12, 34);
  });

  it('issues no token when the feature has no spatial properties', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: null, geometry_count: 0 });

    const mintTokenStub = stubMintToken();

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql({ has_spatial_properties: false });
    expect(mintTokenStub).to.not.have.been.called;
  });

  it('marks the response as uncacheable', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 1 });

    stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/feature/{z}/{x}/{y}');

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.setHeader).to.have.been.calledWith('Cache-Control', 'no-store');
  });

  it('uses the API user connection for anonymous (no token) requests', async () => {
    const dbConnectionObj = getMockDBConnection();
    const getAPIUserDBConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
    const getDBConnectionStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .resolves({ bbox: null, geometry_count: 0 });

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    // No keycloak_token on the request => anonymous caller mapping an unsecured feature.
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
    expect(getDBConnectionStub).to.not.have.been.called;
    expect(mockRes.statusValue).to.eql(200);
  });

  it('propogates and re-throws errors', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getActiveGeometryExtent')
      .throws(new HTTP400('Error', ['Error']));

    const requestHandler = index.createSubmissionFeatureTileSession();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as HTTPError).status).to.equal(400);
      expect((error as HTTPError).message).to.equal('Error');
    }
  });

  it('authorizes the request with the same policy rule as the feature detail endpoint', async () => {
    // The route is authorized before the handler runs, so the handler itself never checks access. This
    // asserts the rule is attached and carries both identifiers: without it the endpoint would mint
    // tokens for features the caller cannot read.
    const authorizeRequestStub = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);

    const authorizeHandler = (index.POST as unknown as RequestHandler[])[1];
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { submissionId: '12', submissionFeatureId: '34' };

    await authorizeHandler(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Policy', submissionFeatureId: 34, submissionId: 12 }]
    });
    expect(authorizeRequestStub).to.have.been.calledOnce;
    expect(mockNext).to.have.been.calledOnce;
  });
});
