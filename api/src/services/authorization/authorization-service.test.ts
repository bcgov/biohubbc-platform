import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import * as db from '../../database/db';
import { SystemUser, SystemUserExtended } from '../../models/system-user';
import { ContributorSystemUserService } from '../contributor-system-user-service';
import { UserService } from '../user-service';
import {
  AuthorizationScheme,
  AuthorizationService,
  AuthorizeBySystemRoles,
  AuthorizeRule
} from './authorization-service';
import { TeamAuthorizationService } from './team-authorization-service';

chai.use(sinonChai);

describe('executeAuthorizationScheme', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if any AND authorizationScheme rules return false', async function () {
    const mockAuthorizationScheme = { and: [] } as unknown as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([true, false, true]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if all AND authorizationScheme rules return true', async function () {
    const mockAuthorizationScheme = { and: [] } as unknown as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([true, true, true]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(true);
  });

  it('returns false if all OR authorizationScheme rules return false', async function () {
    const mockAuthorizationScheme = { or: [] } as unknown as AuthorizationScheme;
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'executeAuthorizeConfig').resolves([false, false, false]);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.executeAuthorizationScheme(mockAuthorizationScheme);

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if any OR authorizationScheme rules return true', async function () {
    const mockAuthorizationScheme = { or: [] } as unknown as AuthorizationScheme;
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
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      },
      {
        discriminator: 'SystemUser'
      },
      {
        discriminator: 'Contributor'
      }
    ];
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemRole').resolves(false);
    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemUser').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'authorizeByContributor').resolves(true);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const authorizeResults = await authorizationService.executeAuthorizeConfig(mockAuthorizeRules);

    expect(authorizeResults).to.eql([false, true, true]);
  });
});

describe('authorizeSystemAdministrator', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if `systemUserObject` is null', async function () {
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.authorizeSystemAdministrator();

    expect(isAuthorized).to.equal(false);
  });

  it('returns true if `systemUserObject` is not null and includes admin role', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = {
      role_names: [SYSTEM_ROLE.SYSTEM_ADMIN],
      display_name: null,
      given_name: null,
      family_name: null,
      email: null,
      agency: null,
      notes: null
    } as unknown as SystemUserExtended;

    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorized = await authorizationService.authorizeSystemAdministrator();

    expect(isAuthorized).to.equal(true);
  });

  it('returns false if the cached system administrator is blocked', async function () {
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: {
        role_names: [SYSTEM_ROLE.SYSTEM_ADMIN],
        record_end_date: '2999-01-01',
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended
    });

    const isAuthorized = await authorizationService.authorizeSystemAdministrator();

    expect(isAuthorized).to.equal(false);
  });
});

describe('authorizeBySystemRole', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if `authorizeSystemRoles` is null', async function () {
    const mockAuthorizeSystemRoles = null as unknown as AuthorizeBySystemRoles;
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns false if `systemUserObject` is null', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = null as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns false if `record_end_date` is set', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = { record_end_date: 'datetime' } as unknown as SystemUserExtended;
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
      systemUser: {} as unknown as SystemUserExtended
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(true);
  });

  it('returns false if the cached system user is blocked', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: {
        role_names: [SYSTEM_ROLE.SYSTEM_ADMIN],
        record_end_date: '2999-01-01',
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns false if the user does not have any valid roles', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: {
        role_names: [],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemRole(mockAuthorizeSystemRoles);

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns true if the user has at least one of the valid roles', async function () {
    const mockAuthorizeSystemRoles: AuthorizeBySystemRoles = {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
      discriminator: 'SystemRole'
    };
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: {
        role_names: [SYSTEM_ROLE.SYSTEM_ADMIN],
        display_name: null,
        given_name: null,
        family_name: null,
        email: null,
        agency: null,
        notes: null
      } as unknown as SystemUserExtended
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

    const mockGetSystemUsersObjectResponse = null as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemUser();

    expect(isAuthorizedBySystemRole).to.equal(false);
  });

  it('returns true if `systemUserObject` is not null', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockGetSystemUsersObjectResponse = null as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(mockGetSystemUsersObjectResponse);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      systemUser: {} as unknown as SystemUserExtended
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeBySystemUser();

    expect(isAuthorizedBySystemRole).to.equal(true);
  });
});

describe('authorizeByContributor', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if the keycloak token is null', async function () {
    const mockDBConnection = getMockDBConnection();

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: undefined
    });

    const result = await authorizationService.authorizeByContributor();

    expect(result).to.be.false;
  });

  it('returns false when no system user is available on the authorization context', async function () {
    const mockDBConnection = getMockDBConnection();
    const findContributorSystemUserStub = sinon.stub(
      ContributorSystemUserService.prototype,
      'findContributorSystemUser'
    );

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { sub: 'some-guid' }
    });

    const result = await authorizationService.authorizeByContributor();

    expect(result).to.be.false;
    expect(findContributorSystemUserStub).not.to.have.been.called;
  });

  it('returns false when no contributor mapping exists for system user', async function () {
    const mockDBConnection = getMockDBConnection();
    const findContributorSystemUserStub = sinon
      .stub(ContributorSystemUserService.prototype, 'findContributorSystemUser')
      .resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { sub: 'some-guid' },
      systemUser: { system_user_id: 9 } as SystemUserExtended
    });

    const result = await authorizationService.authorizeByContributor();

    expect(result).to.be.false;
    expect(findContributorSystemUserStub).to.have.been.calledOnceWith(9);
  });

  it('returns true and sets contributorId when system user maps to contributor', async function () {
    const mockDBConnection = getMockDBConnection();
    const findContributorSystemUserStub = sinon
      .stub(ContributorSystemUserService.prototype, 'findContributorSystemUser')
      .resolves({
        contributor_system_user_id: 1,
        contributor_id: 77,
        system_user_id: 12
      });

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { sub: 'some-guid' },
      systemUser: { system_user_id: 12 } as SystemUserExtended
    });

    const result = await authorizationService.authorizeByContributor();

    expect(result).to.be.true;
    expect(findContributorSystemUserStub).to.have.been.calledOnceWith(12);
    expect(authorizationService.contributorId).to.equal(77);
  });
});

describe('getCachedSystemUser', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns the cached user if already set', async function () {
    const mockDBConnection = getMockDBConnection();
    const systemUser: SystemUserExtended = {
      system_user_id: 1,
      user_identity_source_id: 2,
      identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
      role_ids: [],
      role_names: [],
      display_name: null,
      given_name: null,
      family_name: null,
      email: null,
      agency: null,
      notes: null,
      user_identifier: 'test-user',
      user_guid: 'guid-123',
      record_effective_date: '',
      record_end_date: null,
      create_date: '2023-01-01',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0
    };

    const authorizationService = new AuthorizationService(mockDBConnection);
    authorizationService['_systemUser'] = systemUser;

    const result = await authorizationService.getCachedSystemUser();
    expect(result).to.equal(systemUser);
  });

  it('fetches and caches the user if not already cached', async function () {
    const mockDBConnection = getMockDBConnection();
    const systemUser: SystemUserExtended = {
      system_user_id: 1,
      identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
      role_ids: [],
      role_names: [],
      display_name: null,
      given_name: null,
      family_name: null,
      email: null,
      agency: null,
      notes: null,
      user_identity_source_id: 2,
      user_identifier: 'test-user',
      user_guid: 'guid-123',
      record_effective_date: '',
      record_end_date: null,
      create_date: '2023-01-01',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0
    };

    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getCachedSystemUser();
    expect(result).to.equal(systemUser);
    expect(authorizationService['_systemUser']).to.equal(systemUser);
  });

  it('returns null if no user is found', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getCachedSystemUser();
    expect(result).to.be.null;
    expect(authorizationService['_systemUser']).to.be.undefined;
  });

  it('returns null if the fetched user is blocked', async function () {
    const mockDBConnection = getMockDBConnection();
    const systemUser: SystemUserExtended = {
      system_user_id: 1,
      user_identity_source_id: 2,
      identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
      role_ids: [],
      role_names: [],
      display_name: null,
      given_name: null,
      family_name: null,
      email: null,
      agency: null,
      notes: null,
      user_identifier: 'test-user',
      user_guid: 'guid-123',
      record_effective_date: '',
      record_end_date: '2999-01-01',
      create_date: '2023-01-01',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0
    };
    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getCachedSystemUser();
    expect(result).to.be.null;
    expect(authorizationService['_systemUser']).to.be.undefined;
  });

  it('returns null and clears the cached user if the cached user is blocked', async function () {
    const mockDBConnection = getMockDBConnection();
    const systemUser: SystemUserExtended = {
      system_user_id: 1,
      user_identity_source_id: 2,
      identity_source: SYSTEM_IDENTITY_SOURCE.IDIR,
      role_ids: [],
      role_names: [],
      display_name: null,
      given_name: null,
      family_name: null,
      email: null,
      agency: null,
      notes: null,
      user_identifier: 'test-user',
      user_guid: 'guid-123',
      record_effective_date: '',
      record_end_date: '2999-01-01',
      create_date: '2023-01-01',
      create_user: 1,
      update_date: null,
      update_user: null,
      revision_count: 0
    };

    const authorizationService = new AuthorizationService(mockDBConnection);
    authorizationService['_systemUser'] = systemUser;

    const result = await authorizationService.getCachedSystemUser();
    expect(result).to.be.null;
    expect(authorizationService['_systemUser']).to.be.undefined;
  });
});

describe('authorizeByTeam', function () {
  afterEach(() => {
    sinon.restore();
  });

  const systemUser: SystemUser = {
    system_user_id: 1,
    user_identity_source_id: 2,
    user_identifier: 'test-user',
    user_guid: 'guid-123',
    record_effective_date: '',
    record_end_date: '',
    create_date: '2023-01-01',
    create_user: 1,
    update_date: null,
    update_user: null,
    revision_count: 0,
    display_name: null,
    given_name: null,
    family_name: null,
    email: null,
    agency: null,
    notes: null
  };

  it('returns false if no system user is found', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByTeam({
      discriminator: 'Team',
      entity: 'data_request',
      dataRequestId: 'dr-1'
    });

    expect(result).to.be.false;
  });

  it('returns true when TeamAuthorizationService grants access', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);
    sinon.stub(TeamAuthorizationService.prototype, 'isUserAuthorizedForTeamEntity').resolves(true);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByTeam({
      discriminator: 'Team',
      entity: 'data_request',
      dataRequestId: 'dr-1'
    });

    expect(result).to.be.true;
  });

  it('returns false when TeamAuthorizationService denies access', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);
    sinon.stub(TeamAuthorizationService.prototype, 'isUserAuthorizedForTeamEntity').resolves(false);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByTeam({
      discriminator: 'Team',
      entity: 'data_request',
      dataRequestId: 'dr-1'
    });

    expect(result).to.be.false;
  });
});

describe('hasAtLeastOneValidValue', () => {
  describe('validValues is a string', () => {
    describe('incomingValues is a string', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('', '');

        expect(response).to.be.true;
      });

      it('returns false if the user has no roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', '');

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', 'user');

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', 'admin');

        expect(response).to.be.true;
      });
    });

    describe('incomingValues is an array', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('', []);

        expect(response).to.be.true;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', []);

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', ['user']);

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue('admin', ['admin']);

        expect(response).to.be.true;
      });
    });
  });

  describe('validValues is an array', () => {
    describe('incomingValues is a string', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue([], '');

        expect(response).to.be.true;
      });

      it('returns false if the user has no roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], '');

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], 'user');

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], 'admin');

        expect(response).to.be.true;
      });
    });

    describe('incomingValues is an array', () => {
      it('returns true if the valid roles is empty', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue([], []);

        expect(response).to.be.true;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], []);

        expect(response).to.be.false;
      });

      it('returns false if the user has no matching roles', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], ['user']);

        expect(response).to.be.false;
      });

      it('returns true if the user has a matching role', () => {
        const response = AuthorizationService.hasAtLeastOneValidValue(['admin'], ['admin']);

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

  it('returns a system user', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockSystemUserWithRolesResponse = {} as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserWithRoles').resolves(mockSystemUserWithRolesResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const systemUserObject = await authorizationService.getSystemUserObject();

    expect(systemUserObject).to.equal(mockSystemUserWithRolesResponse);
  });

  it('returns null if the system user is soft-deleted', async function () {
    const mockDBConnection = getMockDBConnection();

    const mockSystemUserWithRolesResponse = {
      record_end_date: '2020-01-01'
    } as unknown as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getSystemUserWithRoles').resolves(mockSystemUserWithRolesResponse);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const systemUserObject = await authorizationService.getSystemUserObject();

    expect(systemUserObject).to.be.null;
  });
});

describe('isSystemUserInactive', function () {
  it('returns false if `record_end_date` is null', function () {
    const result = AuthorizationService.isSystemUserInactive({
      record_end_date: null
    } as unknown as SystemUserExtended);

    expect(result).to.be.false;
  });

  it('returns true if `record_end_date` is set', function () {
    const result = AuthorizationService.isSystemUserInactive({
      record_end_date: '2020-01-01'
    } as unknown as SystemUserExtended);

    expect(result).to.be.true;
  });
});

describe('getSystemUserWithRoles', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null if the keycloak token is null', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.be.null;
  });

  it('returns null if the system user identifier is null', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { preferred_username: '' }
    });

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.be.null;
  });

  it('returns a system user', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const userObjectMock = {} as unknown as SystemUserExtended;
    sinon.stub(UserService.prototype, 'getUserByGuid').resolves(userObjectMock);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { preferred_username: 'userIdentifier@IDIR' }
    });

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.equal(userObjectMock);
  });
});
