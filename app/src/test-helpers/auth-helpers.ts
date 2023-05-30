import { SYSTEM_ROLE } from 'constants/roles';
import { IAuthState } from 'contexts/authStateContext';
import Keycloak from 'keycloak-js';

export const UnauthenticatedUserAuthState: IAuthState = {
  keycloakWrapper: {
    keycloak: {
      authenticated: false
    } as unknown as Keycloak,
    hasLoadedAllUserInfo: false,
    systemRoles: [],
    hasSystemRole: () => false,
    getUserIdentifier: () => 'testusername',
    getIdentitySource: () => 'idir',
    username: 'testusername',
    displayName: 'testdisplayname',
    email: 'test@email.com',
    systemUserId: 1,
    refresh: () => {
      // do nothing
    }
  }
};

export const SystemUserAuthState: IAuthState = {
  keycloakWrapper: {
    keycloak: {
      authenticated: true
    } as unknown as Keycloak,
    hasLoadedAllUserInfo: true,
    systemRoles: [],
    hasSystemRole: () => false,
    getUserIdentifier: () => 'testusername',
    getIdentitySource: () => 'idir',
    username: 'testusername',
    displayName: 'testdisplayname',
    email: 'test@email.com',
    systemUserId: 1,
    refresh: () => {
      // do nothing
    }
  }
};

export const SystemAdminAuthState: IAuthState = {
  keycloakWrapper: {
    keycloak: {
      authenticated: true
    } as unknown as Keycloak,
    hasLoadedAllUserInfo: true,
    systemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
    hasSystemRole: () => true,
    getUserIdentifier: () => 'testusername',
    getIdentitySource: () => 'idir',
    username: 'testusername',
    displayName: 'testdisplayname',
    email: 'test@email.com',
    systemUserId: 1,
    refresh: () => {
      // do nothing
    },
    getLoginUrl: () => 'test/login'
  }
};

// Same effect as `Partial` but applies to all levels of a nested object
type Subset<T> = {
  [P in keyof T]?: T[P] extends Record<any, any> | undefined ? Subset<T[P]> : T[P];
};

/**
 * Build and return a mock auth state object.
 *
 * @param {{ base: IAuthState; overrides?: Subset<IAuthState> }} options
 * @return {*}  {IAuthState}
 */
export const getMockAuthState = (options: { base: IAuthState; overrides?: Subset<IAuthState> }): IAuthState => {
  const { base, overrides } = options;

  return {
    ...base,
    ...overrides,
    keycloakWrapper: {
      ...base.keycloakWrapper,
      ...overrides?.keycloakWrapper,
      Keycloak: {
        ...base.keycloakWrapper?.keycloak,
        ...overrides?.keycloakWrapper?.keycloak
      }
    }
  } as unknown as IAuthState;
};
