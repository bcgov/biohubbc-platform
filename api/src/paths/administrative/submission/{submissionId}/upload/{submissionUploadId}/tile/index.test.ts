import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import * as db from '../../../../../../../database/db';
import { ApiNotFoundError } from '../../../../../../../errors/api-error';
import { HTTP400, HTTPError } from '../../../../../../../errors/http-error';
import { SubmissionUpload } from '../../../../../../../models/submission-upload';
import { authorizationDependencies } from '../../../../../../../request-handlers/security/authorization';
import { MartinTokenService } from '../../../../../../../services/martin-token-service';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../../services/submission-feature-property-geometry-service';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

describe('createSubmissionUploadTileSession', () => {
  afterEach(() => {
    sinon.restore();
  });

  const submissionUploadId = '11111111-1111-4111-8111-111111111111';

  const mockUpload = {
    submission_upload_id: submissionUploadId,
    submission_id: 16,
    upload_id: '22222222-2222-4222-8222-222222222222',
    team_id: null,
    status: 'indexed',
    ticket_id: '33333333-3333-4333-8333-333333333333',
    blueprint_id: 1,
    comment: null,
    record_end_date: null
  } as unknown as SubmissionUpload;

  const stubOwnership = () =>
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId').resolves(mockUpload);

  const stubMintToken = () =>
    sinon.stub(MartinTokenService.prototype, 'mintToken').returns({
      token: 'a.tile.token',
      expiresIn: 900,
      jti: 'jti-1'
    });

  const buildRequest = () => {
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.keycloak_token = {};
    mockReq.params = { submissionId: '16', submissionUploadId };

    return { mockReq, mockRes, mockNext };
  };

  it('returns a session scoped to the requested upload', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    stubOwnership();
    sinon.stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent').resolves({
      bbox: [-125.1, 49.1, -125.0, 49.2],
      geometry_count: 3
    });

    const mintTokenStub = stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/upload/{z}/{x}/{y}');

    const { mockReq, mockRes, mockNext } = buildRequest();

    await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql({
      has_spatial_properties: true,
      token: 'a.tile.token',
      token_type: 'Bearer',
      token_expires_in: 900,
      source: 'upload',
      source_layer: 'geometries',
      martin_url_template: '/martin/upload/{z}/{x}/{y}',
      bbox: [-125.1, 49.1, -125.0, 49.2],
      min_zoom: 0,
      max_zoom: 15
    });
    expect(mintTokenStub).to.have.been.calledOnce;
  });

  it('verifies the upload belongs to the submission before computing the extent, and scopes the token to both', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const ownershipStub = stubOwnership();
    const extentStub = sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent')
      .resolves({ bbox: [-125.1, 49.1, -125.0, 49.2], geometry_count: 1 });

    const mintTokenStub = stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/upload/{z}/{x}/{y}');

    const { mockReq, mockRes, mockNext } = buildRequest();

    await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);

    expect(ownershipStub).to.have.been.calledOnceWith(16, submissionUploadId);
    expect(extentStub).to.have.been.calledOnceWith(16, submissionUploadId);
    expect(ownershipStub).to.have.been.calledBefore(extentStub);
    // The context is the source of truth at serve time, so it must carry exactly the identifiers the
    // ownership check just approved, spelled as stored rather than as sent.
    expect(mintTokenStub).to.have.been.calledOnceWith({
      source: 'upload',
      ctx: `su:16:${submissionUploadId}`
    });
  });

  it('builds the context from the stored upload id rather than the path parameter', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    stubOwnership();
    sinon.stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent').resolves({
      bbox: [-125.1, 49.1, -125.0, 49.2],
      geometry_count: 1
    });

    const mintTokenStub = stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/upload/{z}/{x}/{y}');

    const { mockReq, mockRes, mockNext } = buildRequest();
    mockReq.params = { submissionId: '16', submissionUploadId: submissionUploadId.toUpperCase() };

    await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);

    expect(mintTokenStub).to.have.been.calledOnceWith({
      source: 'upload',
      ctx: `su:16:${submissionUploadId}`
    });
  });

  it('does not mint a token when the upload has no spatial properties', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    stubOwnership();
    sinon.stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent').resolves({
      bbox: null,
      geometry_count: 0
    });

    const mintTokenStub = stubMintToken();

    const { mockReq, mockRes, mockNext } = buildRequest();

    await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.eql(200);
    expect(mockRes.jsonValue).to.eql({ has_spatial_properties: false });
    expect(mintTokenStub).to.not.have.been.called;
  });

  it('never caches the response', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    stubOwnership();
    sinon.stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent').resolves({
      bbox: [-125.1, 49.1, -125.0, 49.2],
      geometry_count: 1
    });
    stubMintToken();
    sinon.stub(MartinTokenService.prototype, 'getMartinUrlTemplate').returns('/martin/upload/{z}/{x}/{y}');

    const { mockReq, mockRes, mockNext } = buildRequest();

    await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);

    expect(mockRes.setHeader).to.have.been.calledWith('Cache-Control', 'no-store');
  });

  it('rejects a mismatched submission and upload before computing an extent or minting', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const rollbackStub = sinon.stub(dbConnectionObj, 'rollback').resolves();

    sinon
      .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionId')
      .rejects(new ApiNotFoundError('Submission upload not found'));
    const extentStub = sinon.stub(
      SubmissionFeaturePropertyGeometryService.prototype,
      'getSubmissionUploadGeometryExtent'
    );
    const mintTokenStub = stubMintToken();

    const { mockReq, mockRes, mockNext } = buildRequest();

    try {
      await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiNotFoundError);
    }

    expect(extentStub).to.not.have.been.called;
    expect(mintTokenStub).to.not.have.been.called;
    expect(rollbackStub).to.have.been.calledOnce;
  });

  it('propagates and re-throws errors', async () => {
    const dbConnectionObj = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    stubOwnership();
    sinon
      .stub(SubmissionFeaturePropertyGeometryService.prototype, 'getSubmissionUploadGeometryExtent')
      .throws(new HTTP400('Error', ['Error']));

    const { mockReq, mockRes, mockNext } = buildRequest();

    try {
      await index.createSubmissionUploadTileSession()(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as HTTPError).status).to.equal(400);
      expect((error as HTTPError).message).to.equal('Error');
    }
  });

  it('authorizes the request for system administrators only', async () => {
    // The route is authorized before the handler runs, so the handler itself never checks the role.
    // This asserts the rule is attached: without it the endpoint would mint upload tokens for anyone.
    const authorizeRequestStub = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);

    const authorizeHandler = (index.POST as unknown as RequestHandler[])[1];
    const { mockReq, mockRes, mockNext } = buildRequest();

    await authorizeHandler(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
    });
    expect(authorizeRequestStub).to.have.been.calledOnce;
    expect(mockNext).to.have.been.calledOnce;
  });
});
