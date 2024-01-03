import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { SYSTEM_ROLE } from 'constants/roles';
import { IAuthState } from 'contexts/authStateContext';
import { AuthContextProps } from 'react-oidc-context';

/**
 * Represents an unauthenticated user who has:
 *  - not yet successfully authenticated (all keycloak details about the user will be false, null, or undefined)
 */
export const UnauthenticatedUserAuthState: IAuthState = {
  auth: {
    isLoading: false,
    isAuthenticated: false,
    signoutRedirect: () => {
      // do nothing
    },
    signinRedirect: () => {
      // do nothing
    }
  } as unknown as AuthContextProps,
  biohubUserWrapper: {
    isLoading: false,
    systemUserId: undefined,
    userGuid: null,
    userIdentifier: undefined,
    roleNames: [],
    identitySource: null
  }
};

/**
 * Represents an IDIR user who has:
 *  - successfully authenticated
 *  - has already been granted system access (has no pending access request)
 *  - has had all user info loaded successfully
 *  - has no system or project level roles
 */
export const SystemUserAuthState: IAuthState = {
  auth: {
    isLoading: false,
    isAuthenticated: true,
    signoutRedirect: () => {
      // do nothing
    },
    signinRedirect: () => {
      // do nothing
    }
  } as unknown as AuthContextProps,
  biohubUserWrapper: {
    isLoading: false,
    systemUserId: 1,
    userGuid: '987-654-321',
    userIdentifier: 'testusername',
    roleNames: [],
    identitySource: SYSTEM_IDENTITY_SOURCE.IDIR
  }
};

/**
 * Represents an IDIR user who has:
 *  - successfully authenticated
 *  - has already been granted system access (has no pending access request)
 *  - has had all user info loaded successfully
 *  - has the `System Administrator` system level role
 */
export const SystemAdminAuthState: IAuthState = {
  auth: {
    isLoading: false,
    isAuthenticated: true,
    signoutRedirect: () => {
      // do nothing
    },
    signinRedirect: () => {
      // do nothing
    }
  } as unknown as AuthContextProps,
  biohubUserWrapper: {
    isLoading: false,
    systemUserId: 1,
    userGuid: '123-456-789',
    userIdentifier: 'admin-username',
    roleNames: [SYSTEM_ROLE.SYSTEM_ADMIN],
    identitySource: SYSTEM_IDENTITY_SOURCE.IDIR
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
    auth: {
      ...base.auth,
      ...overrides?.auth
    },
    biohubUserWrapper: {
      ...base.biohubUserWrapper,
      ...overrides?.biohubUserWrapper
    }
  } as unknown as IAuthState;
};
