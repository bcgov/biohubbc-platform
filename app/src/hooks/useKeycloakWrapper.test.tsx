import { renderHook } from '@testing-library/react-hooks';
import { getMockAuthState } from 'test-helpers/auth-helpers';
import useKeycloakWrapper from './useKeycloakWrapper';

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

  // it('just does something', async () => {
  //   const useKeycloak = jest.fn();

  //   const { result } = renderHook(() => useKeycloakWrapper());

  //   expect(result.current).toBeDefined();
  // });
});
