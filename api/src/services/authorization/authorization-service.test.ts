import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_IDENTITY_SOURCE } from '../../constants/database';
import { SYSTEM_ROLE } from '../../constants/roles';
import * as db from '../../database/db';
import { Cart, CartStatus } from '../../models/cart';
import { SystemUser, SystemUserExtended } from '../../repositories/user-repository';
import * as keycloakUtils from '../../utils/keycloak-utils';
import { getMockDBConnection } from '../../__mocks__/db';
import { CartService } from '../cart-service';
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
        discriminator: 'ServiceClient'
      }
    ];
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemRole').resolves(false);
    sinon.stub(AuthorizationService.prototype, 'authorizeBySystemUser').resolves(true);
    sinon.stub(AuthorizationService.prototype, 'authorizeByServiceClient').resolves(true);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const authorizeResults = await authorizationService.executeAuthorizeConfig(mockAuthorizeRules);

    expect(authorizeResults).to.eql([false, true, true]);
  });
});

describe('authorizeByServiceClient', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if `systemUserObject` is null', async function () {
    const mockDBConnection = getMockDBConnection();

    sinon.stub(AuthorizationService.prototype, 'getSystemUserObject').resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const isAuthorizedByServiceClient = await authorizationService.authorizeSystemAdministrator();

    expect(isAuthorizedByServiceClient).to.equal(false);
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

    const isAuthorizedByServiceClient = await authorizationService.authorizeSystemAdministrator();

    expect(isAuthorizedByServiceClient).to.equal(true);
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

  it('returns false if `record_end_date` is null', async function () {
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

describe('authorizeByServiceClient', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns false if the keycloak token is null', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: undefined
    });

    const result = await authorizationService.authorizeByServiceClient();

    expect(result).to.be.false;
  });

  it('returns false if the service client does not match a known service client system user', async function () {
    const mockDBConnection = getMockDBConnection();

    const systemUser = null;

    const getServiceClientSystemUserStub = sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(systemUser);

    const keycloakToken = {
      preferred_username: 'unknown-user'
    };
    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: keycloakToken
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeByServiceClient();

    expect(isAuthorizedBySystemRole).to.equal(false);
    expect(getServiceClientSystemUserStub).to.have.been.calledOnceWith(keycloakToken);
  });

  it('returns true if the service client matches a known service client system user', async function () {
    const mockDBConnection = getMockDBConnection();

    const systemUser: SystemUser = {
      system_user_id: 1,
      user_identity_source_id: 2,
      user_identifier: 'sims-svc-4464',
      user_guid: 'service-account-sims-svc-4464',
      record_effective_date: '',
      record_end_date: '',
      create_date: '2023-12-12',
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

    const getServiceClientSystemUserStub = sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(systemUser);

    const keycloakToken = {
      preferred_username: 'sims-svc-4464'
    };
    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: keycloakToken
    });

    const isAuthorizedBySystemRole = await authorizationService.authorizeByServiceClient();

    expect(isAuthorizedBySystemRole).to.equal(true);
    expect(getServiceClientSystemUserStub).to.have.been.calledOnceWith(keycloakToken);
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
      record_end_date: '',
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
      record_end_date: '',
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

describe('authorizeByCart', function () {
  afterEach(() => {
    sinon.restore();
  });

  const fakeCart: Cart = {
    cart_id: 'cart-1',
    cart_status: CartStatus.ACTIVE,
    system_user_id: 1,
    record_end_date: null
  };

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

  it('returns true if the user owns the cart', async function () {
    const mockDBConnection = getMockDBConnection();
    const fakeCart: Cart = {
      cart_id: 'cart-1',
      system_user_id: 1,
      cart_status: CartStatus.ACTIVE,
      record_end_date: null
    };

    sinon.stub(CartService.prototype, 'findCartById').resolves(fakeCart);

    const systemUser = { system_user_id: 1 } as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.true;
  });

  it('returns false if the user does not own the cart', async function () {
    const mockDBConnection = getMockDBConnection();
    const fakeCartWithDifferentOwner: Cart = {
      cart_id: 'cart-1',
      cart_status: CartStatus.ACTIVE,
      system_user_id: 2,
      record_end_date: null
    };
    sinon.stub(CartService.prototype, 'findCartById').resolves(fakeCartWithDifferentOwner);
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns true if the cart is unauthenticated (no system_user_id)', async function () {
    const mockDBConnection = getMockDBConnection();
    const fakeUnauthenticatedCart: Cart = {
      cart_id: 'cart-1',
      cart_status: CartStatus.ACTIVE,
      system_user_id: null, // No system_user_id, indicating it's unauthenticated
      record_end_date: null
    };
    sinon.stub(CartService.prototype, 'findCartById').resolves(fakeUnauthenticatedCart);
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.true;
  });

  it('returns false if cart does not exist', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves(null);
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns false if no system user is found (user is unauthenticated)', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves(fakeCart);
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(null);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns false if cart is checked out', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves({
      cart_id: 'cart-1',
      cart_status: CartStatus.CHECKED_OUT,
      system_user_id: 1,
      record_end_date: null
    });
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns false if cart is expired', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves({
      cart_id: 'cart-1',
      cart_status: CartStatus.EXPIRED,
      system_user_id: 1,
      record_end_date: null
    });
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns false if cart is abandoned', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves({
      cart_id: 'cart-1',
      cart_status: CartStatus.ABANDONED,
      system_user_id: 1,
      record_end_date: null
    });
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns false if cart record_end_date is in the past', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves({
      cart_id: 'cart-1',
      cart_status: CartStatus.ACTIVE,
      system_user_id: 1,
      record_end_date: '2000-01-01T00:00:00.000Z'
    });
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.false;
  });

  it('returns true if cart record_end_date is in the future and user owns the cart', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(CartService.prototype, 'findCartById').resolves({
      cart_id: 'cart-1',
      cart_status: CartStatus.ACTIVE,
      system_user_id: 1,
      record_end_date: '2999-01-01T00:00:00.000Z'
    });

    const systemUser = { system_user_id: 1 } as SystemUserExtended;
    sinon.stub(AuthorizationService.prototype, 'getCachedSystemUser').resolves(systemUser);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.authorizeByCart({
      discriminator: 'Cart',
      cartId: 'cart-1'
    });

    expect(result).to.be.true;
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
});

describe('getSystemUserWithRoles', function () {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null if the keycloak token is null', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection);

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.be.null;
  });

  it('returns null if the system user identifier is null', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { preferred_username: '' }
    });

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.be.null;
  });

  it('returns a system user', async function () {
    const mockDBConnection = getMockDBConnection();
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const userObjectMock = {} as unknown as SystemUserExtended;
    sinon.stub(UserService.prototype, 'getUserByGuid').resolves(userObjectMock);

    const authorizationService = new AuthorizationService(mockDBConnection, {
      keycloakToken: { preferred_username: 'userIdentifier@IDIR' }
    });

    const result = await authorizationService.getSystemUserWithRoles();

    expect(result).to.equal(userObjectMock);
  });
});
