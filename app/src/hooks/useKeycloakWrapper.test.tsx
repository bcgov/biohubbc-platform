import { ReactKeycloakProvider } from '@react-keycloak/web';
import { renderHook } from '@testing-library/react-hooks';
import Keycloak, { KeycloakPromise } from 'keycloak-js';

import { getMockAuthState } from 'test-helpers/auth-helpers';
import useKeycloakWrapper from './useKeycloakWrapper';

const TestWrapper = () => {
  const keycloak: Keycloak = {
    authenticated: true,
    init: () => Promise.resolve(true) as KeycloakPromise<any, any>, // new Promise((resolve, reject) => {resolve(true)}),
    // login: () => new KeycloakPromise<void, void>(),
    // logout: () => new KeycloakPromise<void, void>(),
    // register: (): KeycloakPromise<void, void>,
    // accountManagement(): KeycloakPromise<void, void>,
    createLoginUrl: () => 'string',
    createLogoutUrl: () => 'string',
    createRegisterUrl: () => 'string',
    createAccountUrl: () => 'string',
    isTokenExpired: () => false,
    // updateToken: (0) => KeycloakPromise<boolean, boolean>,
    clearToken: () => null,
    hasRealmRole: () => true,
    hasResourceRole: () => true,
    // loadUserProfile(): KeycloakPromise<KeycloakProfile, void>;
    // loadUserInfo(): KeycloakPromise<{}, void>;
  } as unknown as Keycloak;

  return (
      <ReactKeycloakProvider
        authClient={keycloak}
      />
  )
}

describe('useKeycloakWrapper', () => {
  it('TBD: not a valid test yet -----returns an object with the correct shape', async () => {
    const authState = getMockAuthState({
      keycloakWrapper: { hasSystemRole: () => false }
    });
    console.log(authState);

    expect(authState.keycloakWrapper).toEqual(
      expect.objectContaining({
        keycloak: { authenticated: true },
        hasLoadedAllUserInfo: true,
        systemRoles: [],
        hasSystemRole: expect.any(Function),
        hasAccessRequest: expect.any(Boolean),
        getUserIdentifier: expect.any(Function),
        getIdentitySource: expect.any(Function),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        systemUserId: 1,
        refresh: expect.any(Function)
      })
    );
  });

  it('just does something', async () => {

    // const useKeycloak = jest.fn();

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper: TestWrapper
    });

    expect(result.current).toBeDefined();
  });
});
