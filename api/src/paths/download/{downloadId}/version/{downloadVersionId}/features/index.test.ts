import chai, { expect } from 'chai';
import { Operation } from 'express-openapi';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, listDownloadVersionFeatures } from '.';
import { GET as versionGET } from '..';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../../__mocks__/operation';
import * as db from '../../../../../../database/db';
import { HTTP409 } from '../../../../../../errors/http-error';
import { DownloadVersionFeature } from '../../../../../../models/download-version';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { AuthorizationScheme } from '../../../../../../services/authorization/authorization-service';
import { DownloadService } from '../../../../../../services/download/download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/version/{downloadVersionId}/features/index', () => {
  afterEach(() => sinon.restore());

  /**
   * Run an operation's authorization step (its first handler) for a request with the given params,
   * with the authorization check itself stubbed, and return the scheme the route declared.
   */
  async function declaredAuthorizationScheme(
    operation: Operation,
    params: Record<string, string>
  ): Promise<AuthorizationScheme | undefined> {
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = params;

    await getOperationHandler(operation, 0)(mockReq, mockRes, mockNext);

    return mockReq.authorization_scheme;
  }

  it('AC9 GET.apiDoc.security is the optional bearer, as on the version route', () => {
    expect(GET.apiDoc?.security).to.eql([{ OptionalBearer: [] }]);
    expect(GET.apiDoc?.security).to.eql(versionGET.apiDoc?.security);
  });

  it('AC9 GET is authorized by the Download scheme keyed by req.params.downloadId', async () => {
    const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);

    const scheme = await declaredAuthorizationScheme(GET, { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID });

    expect(authorize).to.have.been.calledOnce;
    expect(scheme).to.eql({ and: [{ discriminator: 'Download', downloadId: DOWNLOAD_ID }] });
  });

  it('AC9 GET declares the same authorization scheme as the version route for the same request', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

    const featuresScheme = await declaredAuthorizationScheme(GET, params);
    const versionScheme = await declaredAuthorizationScheme(versionGET, params);

    expect(featuresScheme, 'authorization scheme of the features route').to.not.equal(undefined);
    expect(featuresScheme).to.eql(versionScheme);
  });

  it('AC9 GET refuses with Access Denied and never reaches the handler when the Download authorization fails', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

    let caught: unknown;
    try {
      await getOperationHandler(GET, 0)(mockReq, mockRes, mockNext);
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.equal('Access Denied');
    expect(mockNext).not.to.have.been.called;
  });

  it('GET.apiDoc accepts page and limit as its only query parameters', () => {
    // Verifies: the list has one fixed order, so the route does not declare sort or order

    // Step 1: Read the declared query parameter names
    const queryParameterNames = (GET.apiDoc?.parameters ?? []).flatMap((parameter) =>
      'in' in parameter && parameter.in === 'query' ? [parameter.name] : []
    );

    // Step 2: Only page and limit are declared
    expect(queryParameterNames).to.eql(['page', 'limit']);
  });

  describe('listDownloadVersionFeatures (GET)', () => {
    const feature: DownloadVersionFeature = {
      submission_feature_id: 7,
      uuid: 'ffff0000-0000-0000-0000-000000000007',
      submission_id: 3,
      feature_type_id: 2,
      feature_type_name: 'observation'
    };

    it('returns 200 with the features, is_snapshot and a pagination envelope built from the service count', async () => {
      // Verifies: the handler passes both path ids and the parsed page to the one service method, and
      // turns its count into the pagination envelope instead of returning it as a field

      // Step 1: Stub the connection and the service method
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      const listStub = sinon
        .stub(DownloadService.prototype, 'listDownloadVersionFeatures')
        .resolves({ features: [feature], count: 11, is_snapshot: true });

      // Step 2: Call the handler as a signed-in user asking for page 2 of 5
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };
      mockReq.query = { page: '2', limit: '5' };

      await listDownloadVersionFeatures()(mockReq, mockRes, mockNext);

      // Step 3: The service received the download id, the version id and the numeric page
      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID, VERSION_ID, {
        page: 2,
        limit: 5,
        sort: undefined,
        order: undefined
      });

      // Step 4: The body is exactly features, is_snapshot and pagination (11 rows at 5 per page: 3 pages)
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        features: [feature],
        is_snapshot: true,
        pagination: {
          total: 11,
          per_page: 5,
          current_page: 2,
          last_page: 3,
          sort: undefined,
          order: undefined
        }
      });
    });

    it('uses the API user connection when no bearer token is present', async () => {
      // Verifies: an anonymous caller (a download with no team) is served on the API-user connection

      // Step 1: Stub the API-user connection and the service method
      const dbConnectionObj = getMockDBConnection();
      const getAPIUserDBConnectionStub = sinon
        .stub(db.dbDependencies, 'getAPIUserDBConnection')
        .returns(dbConnectionObj);
      sinon
        .stub(DownloadService.prototype, 'listDownloadVersionFeatures')
        .resolves({ features: [], count: 0, is_snapshot: false });

      // Step 2: Call the handler with no token
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

      await listDownloadVersionFeatures()(mockReq, mockRes, mockNext);

      // Step 3: The API-user connection was used, and is_snapshot false is passed through
      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.have.property('is_snapshot', false);
    });

    it('rolls back and rethrows the HTTP409 the service raises for a version that is not ready', async () => {
      // Verifies: a service error is not swallowed or turned into a response; the transaction is
      // rolled back, not committed

      // Step 1: Stub the connection and make the service reject
      const rollbackStub = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, commit: commitStub });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadService.prototype, 'listDownloadVersionFeatures')
        .rejects(new HTTP409('Download version is not ready — cannot list features'));

      // Step 2: Call the handler and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionId: VERSION_ID };

      let caught: unknown;
      try {
        await listDownloadVersionFeatures()(mockReq, mockRes, mockNext);
      } catch (error) {
        caught = error;
      }

      // Step 3: The error surfaces, the transaction was rolled back, and nothing was sent
      expect(caught).to.be.instanceOf(HTTP409);
      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).not.to.have.been.called;
      expect(mockRes.jsonValue).to.equal(undefined);
    });
  });
});
