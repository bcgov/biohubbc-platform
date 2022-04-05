import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_ROLE } from '../constants/roles';
import * as db from '../database/db';
import { Models } from '../models';
import {
  AuthorizationScheme,
  AuthorizationService,
  AuthorizeBySystemRoles,
  AuthorizeRule
} from '../services/authorization-service';
import { UserService } from '../services/user-service';
import { getMockDBConnection } from '../__mocks__/db';

chai.use(sinonChai);

describe('executeAuthorizationScheme', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if any AND authorizationScheme rules return false', async function () {
    const mockAuthorizationScheme = ({ and: [] } as unknown) as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([true, false, true]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if all AND authorizationScheme rules return true', async function () {
    const mockAuthorizationScheme = ({ and: [] } as unknown) as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([true, true, true]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(true);
  });

  it('returns false if all OR authorizationScheme rules return false', async function () {
    const mockAuthorizationScheme = ({ or: [] } as unknown) as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([false, false, false]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if any OR authorizationScheme rules return true', async function () {
    const mockAuthorizationScheme = ({ or: [] } as unknown) as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([false, true, false]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(true);
  });
});

describe('executeAuthorizeConfig', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns an array of authorizeRule results', async function () {
    const mockAuthorizeRules: AuthorizeRule[] = [
      {
        validSystemRoles: [SYSTEM_ROLE.PROJECT_CREATOR],
        discriminator: 'SystemRole'
      },
      {
        discriminator: 'SystemUser'
      }
    ];
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemRole').resolves(false);
    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemUser').resolves(true);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const authorizeResults = await authorizationService.executeAuthorizeConfig(mockAuthorizeRules);

    expect(authorizeResults).to.eql([false, true]);
  });
});

describe('authorizeBySystemRole', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if `authorizeSystemRoles` is null', async function () {
    const mockAuthorizeSystemRoles = (null as unknown) as AuthorizeBySystemRoles;
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns false if `systemUserObject` is null', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.PROJECT_CREATOR],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = (null as unknown) as Models.user.UserObject;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns true if `authorizeSystemRoles` specifies no valid roles', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: ({} as unknown) as Models.user.UserObject
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(true);
  });

  it('returns false if the user does not have any valid roles', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.PROJECT_CREATOR],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: ({ role_names: [] } as unknown) as Models.user.UserObject
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns true if the user has at least one of the valid roles', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.PROJECT_CREATOR],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: ({ role_names: [SYSTEM_ROLE.PROJECT_CREATOR] } as unknown) as Models.user.UserObject
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(true);
  });
});

describe('authorizeBySystemUser', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if `systemUserObject` is null', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = (null as unknown) as Models.user.UserObject;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemUser();

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns true if `systemUserObject` is not null', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = (null as unknown) as Models.user.UserObject;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: ({} as unknown) as Models.user.UserObject
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemUser();

    expect(isAuthorizedBySystemRole).to.equal(true);
  });
});

describe('userHasValidRole', () => {
  describe('validSystemRoles is a string', () => {
    describe('userSystemRoles is a string', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.userHasValidRole('', '');

        expect(response).to.be.true;
      });

      it('returns false if the user has no roles', () => {
        const response = AuthorizationService.userHasValidRole('admin', '');

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole('admin', 'user');

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.userHasValidRole('admin', 'admin');

        expect(response).to.be.true;
      });
    });

    describe('userSystemRoles is an array', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.userHasValidRole('', []);

        expect(response).to.be.true;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole('admin', []);

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole('admin', ['user']);

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.userHasValidRole('admin', ['admin']);

        expect(response).to.be.true;
      });
    });
  });

  describe('validSystemRoles is an array', () => {
    describe('userSystemRoles is a string', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.userHasValidRole([], '');

        expect(response).to.be.true;
      });

      it('returns false if the user has no roles', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], '');

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], 'user');

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], 'admin');

        expect(response).to.be.true;
      });
    });

    describe('userSystemRoles is an array', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.userHasValidRole([], []);

        expect(response).to.be.true;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], []);

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], ['user']);

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.userHasValidRole(['admin'], ['admin']);

        expect(response).to.be.true;
      });
    });
  });
});

describe('getSystemUserObject', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null if fetching the system user throws an error', async function () {
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'getSystemUserWithRoles').callsFake(() => {
      throw new Error('Test Error');
    });

    const authorizationService = new AuthorizationService(mockDBConnection);

    const systemUserObject = await authorizationService.getSystemUserObject();

    expect(systemUserObject).to.equal(null);
  });

  it('returns null if the system user is null or undefined', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockSystemUserWithRolesResponse = null;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserWithRoles').resolves(mockSystemUserWithRolesResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const systemUserObject = await authorizationService.getSystemUserObject();

    expect(systemUserObject).to.equal(null);
  });

  it('returns a `UserObject`', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockSystemUserWithRolesResponse = new Models.user.UserObject();
    sinon.stub(AuthorizationService.prototype, 'getSystemUserWithRoles').resolves(mockSystemUserWithRolesResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const systemUserObject = await authorizationService.getSystemUserObject();

    expect(systemUserObject).to.equal(mockSystemUserWithRolesResponse);
  });
});

describe('getSystemUserWithRoles', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null if the system user id is null', async function () {
    const mockDBConnection = getMockDBConnection({ systemUserId: () => (null as unknown) as number });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.be.null;
  });

  it('returns a UserObject', async function () {
    const mockDBConnection = getMockDBConnection({ systemUserId: () => 1 });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const userObjectMock = new Models.user.UserObject();
    sinon.stub(UserService.prototype, 'getUserById').resolves(userObjectMock);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.equal(userObjectMock);
  });
});
