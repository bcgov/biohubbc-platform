import { ReactKeycloakProvider } from '@react-keycloak/web';
import { cleanup, renderHook } from '@testing-library/react-hooks';
import Keycloak, { KeycloakPromise } from 'keycloak-js';
import { PropsWithChildren } from 'react';
import { act } from 'react-dom/test-utils';
import { useApi } from './useApi';
import useKeycloakWrapper, { SYSTEM_IDENTITY_SOURCE } from './useKeycloakWrapper';

const getMockTestWrapper = (userInfo?: any) => {
  const mockLoadUserInfo = Promise.resolve(
    userInfo || {
      display_name: 'testname',
      email: 'text@example.com',
      email_verified: false,
      idir_user_guid: 'aaaa',
      idir_username: 'testuser',
      preferred_username: 'aaaa@idir',
      sub: 'aaaa@idir'
    }
  );

  const keycloak: Keycloak = {
    authenticated: true,
    init: () => Promise.resolve(true) as KeycloakPromise<any, any>,
    createLoginUrl: () => 'string',
    createLogoutUrl: () => 'string',
    createRegisterUrl: () => 'string',
    createAccountUrl: () => 'string',
    isTokenExpired: () => false,
    clearToken: () => null,
    hasRealmRole: () => true,
    hasResourceRole: () => true,
    loadUserInfo: () => mockLoadUserInfo
  } as unknown as Keycloak;

  return {
    wrapper: (props: PropsWithChildren) => (
      <ReactKeycloakProvider authClient={keycloak}>{props.children}</ReactKeycloakProvider>
    ),
    mockLoadUserInfo
  };
};

jest.mock('./useApi');

const mockBiohubApi = useApi as jest.Mock;

const mockUseApi = {
  user: {
    getUser: jest.fn()
  }
};

describe('useKeycloakWrapper', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders successfully', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper();
    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current).toBeDefined();
  });

  it('loads the Keycloak userinfo on mount', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper();
    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.displayName).toEqual('testname');
    expect(result.current.email).toEqual('text@example.com');
    expect(result.current.getIdentitySource()).toEqual(SYSTEM_IDENTITY_SOURCE.IDIR);
    expect(result.current.getUserIdentifier()).toEqual('testuser');
  });

  it('returns a null user identifier', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper({
      display_name: 'testname',
      email: 'text@example.com',
      email_verified: false,
      preferred_username: 'aaaa@idir',
      sub: 'aaaa@idir'
    });

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.getUserIdentifier()).toEqual(null);
  });

  it('returns a null identity source', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper({
      display_name: 'testname',
      email: 'text@example.com',
      email_verified: false,
      preferred_username: 'aaaa@',
      sub: 'aaaa@'
    });

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.getIdentitySource()).toEqual(null);
  });

  it('returns an IDIR identity source', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper({
      preferred_username: 'aaaa@idir',
      sub: 'aaaa@idir'
    });

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.getIdentitySource()).toEqual(SYSTEM_IDENTITY_SOURCE.IDIR);
  });

  it('returns an BCEID basic identity source', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper({
      preferred_username: 'aaaa@bceidbasic',
      sub: 'aaaa@bceidbasic'
    });

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.getIdentitySource()).toEqual(SYSTEM_IDENTITY_SOURCE.BCEID_BASIC);
  });

  it('returns an BCEID business identity source', async () => {
    const { wrapper, mockLoadUserInfo } = getMockTestWrapper({
      preferred_username: 'aaaa@bceidbusiness',
      sub: 'aaaa@bceidbusiness'
    });

    const { result } = renderHook(() => useKeycloakWrapper(), {
      wrapper
    });

    await act(async () => {
      await mockLoadUserInfo;
    });

    expect(result.current.keycloak).toBeDefined();
    expect(result.current.getIdentitySource()).toEqual(SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS);
  });
});