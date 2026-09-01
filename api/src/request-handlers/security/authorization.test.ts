import chai, { expect } from 'chai';
import { Request } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../__mocks__/db';
import { HTTPError } from '../../errors/http-error';
import { SystemUserExtended } from '../../models/system-user';
import { AuthorizationService } from '../../services/authorization/authorization-service';
import { ContributorSystemUserService } from '../../services/contributor-system-user-service';
import * as authorization from './authorization';

chai.use(sinonChai);

describe('authorizeRequestHandler', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('throws a 403 error if the user is not authorized', async function () {
    registerMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(authorization.authorizationDependencies, 'authorizeRequest').resolves(false);

    const mockAuthorizationSchemeCallback = () => {
      return { or: [] };
    };

    const requestHandler = authorization.authorizeRequestHandler(mockAuthorizationSchemeCallback);

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (error) {
      expect((error as HTTPError).message).to.equal('Access Denied');
      expect((error as HTTPError).status).to.equal(403);
    }

    expect(mockNext).not.to.have.been.called;
  });

  it('calls next if the user is authorized', async function () {
    registerMockDBConnection();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(authorization.authorizationDependencies, 'authorizeRequest').resolves(true);

    const mockAuthorizationSchemeCallback = () => {
      return { or: [] };
    };

    const requestHandler = authorization.authorizeRequestHandler(mockAuthorizationSchemeCallback);

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockNext).to.have.been.calledOnce;
  });
});

describe('authorizeRequest', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if systemUserObject is null', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = undefined as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if the user is a system administrator', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('calls executeAuthorizationScheme even if the user is a system administrator', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    const executeAuthorizationSchemeStub = sinon
      .stub(AuthorizationService.prototype, 'executeAuthorizationScheme')
      .resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
    expect(executeAuthorizationSchemeStub).to.have.been.calledOnce;
  });

  it('returns true if the authorization_scheme is undefined', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    const mockReq = { authorization_scheme: undefined } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns true if the user is authorized against the authorization_scheme', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(true);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns true for a direct single-rule authorization scheme', async function () {
    registerMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(true);

    const mockReq = { authorization_scheme: { discriminator: 'Contributor' } } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('returns false if the user is not authorized against the authorization_scheme', async function () {
    registerMockDBConnection();

    const mockSystemUserObject = { role_names: [] } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockSystemUserObject);

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('returns false if an error is thrown', async function () {
    registerMockDBConnection({
      open: sinon.stub().callsFake(() => {
        throw new Error('Test Error');
      })
    });

    const mockReq = { authorization_scheme: {} } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(false);
  });

  it('allows system admin bypass for contributor authorization', async function () {
    registerMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'executeAuthorizationScheme').resolves(false);

    const mockReq = { authorization_scheme: { discriminator: 'Contributor' } } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
  });

  it('populates contributor_id for system admins when contributor authorization runs', async function () {
    registerMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(true);
    const executeAuthorizationSchemeStub = sinon
      .stub(AuthorizationService.prototype, 'executeAuthorizationScheme')
      .callsFake(async function (this: AuthorizationService) {
        this['_contributorId'] = 77;
        return false;
      });

    const mockReq = { authorization_scheme: { and: [{ discriminator: 'Contributor' }] } } as unknown as Request;
    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
    expect(executeAuthorizationSchemeStub).to.have.been.calledOnce;
    expect(mockReq.contributor_id).to.equal(77);
  });

  it('uses req.system_user.system_user_id for Contributor authorization (not DB connection system user id)', async function () {
    registerMockDBConnection({
      systemUserId: () => 999
    });

    sinon.stub(AuthorizationService.prototype, 'authorizeSystemAdministrator').resolves(false);

    const findContributorSystemUserStub = sinon
      .stub(ContributorSystemUserService.prototype, 'findContributorSystemUser')
      .resolves({
        contributor_system_user_id: 1,
        contributor_id: 77,
        system_user_id: 12
      });

    const mockReq = {
      authorization_scheme: { and: [{ discriminator: 'Contributor' }] },
      keycloak_token: { sub: 'some-guid' },
      system_user: { system_user_id: 12 }
    } as unknown as Request;

    const isAuthorized = await authorization.authorizeRequest(mockReq);

    expect(isAuthorized).to.equal(true);
    expect(findContributorSystemUserStub).to.have.been.calledOnceWith(12);
    expect(mockReq.contributor_id).to.equal(77);
  });
});
