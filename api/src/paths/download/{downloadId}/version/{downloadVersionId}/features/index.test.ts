import chai, { expect } from 'chai';
import { Operation } from 'express-openapi';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET } from '.';
import { GET as versionGET } from '..';
import { getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../../__mocks__/operation';
import { authorizationDependencies } from '../../../../../../request-handlers/security/authorization';
import { AuthorizationScheme } from '../../../../../../services/authorization/authorization-service';

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
});
