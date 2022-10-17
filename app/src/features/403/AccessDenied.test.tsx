import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { getMockAuthState } from 'test-helpers/auth-helpers';
import { fireEvent, render } from 'test-helpers/test-utils';
import AccessDenied from './AccessDenied';

const history = createMemoryHistory();

describe('AccessDenied', () => {
  it('redirects to `/` when user is not authenticated', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        keycloak: {
          authenticated: false
        },
        hasLoadedAllUserInfo: false,
        hasAccessRequest: false,

        systemRoles: [],
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/forbidden');

    render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(history.location.pathname).toEqual('/');
  });

  it('renders a spinner when user is authenticated and `hasLoadedAllUserInfo` is false', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        keycloak: {
          authenticated: true
        },
        hasLoadedAllUserInfo: false,
        hasAccessRequest: false,

        systemRoles: [],
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/forbidden');

    const { queryByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    // does not change location
    expect(history.location.pathname).toEqual('/forbidden');

    // renders a spinner
    expect(queryByText('Access Denied')).toEqual(null);
  });

  it('redirects to `/request-submitted` when user is authenticated and has a pending access request', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        keycloak: {
          authenticated: true
        },
        hasLoadedAllUserInfo: true,
        hasAccessRequest: true,

        systemRoles: [],
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/forbidden');

    render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(history.location.pathname).toEqual('/request-submitted');
  });

  it('renders correctly when the user is authenticated and has no pending access requests', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        keycloak: {
          authenticated: true
        },
        hasLoadedAllUserInfo: true,
        hasAccessRequest: false,

        systemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        refresh: () => {}
      }
    });

    const { getByText, queryByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(getByText('You do not have permission to access this page.')).toBeVisible();
    expect(queryByTestId('request_access')).not.toBeInTheDocument();
  });

  it('redirects to `/access-request` when the `Request Access` button clicked', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        keycloak: {
          authenticated: true
        },
        hasLoadedAllUserInfo: true,
        hasAccessRequest: false,

        systemRoles: [],
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        refresh: () => {}
      }
    });

    const { getByText, getByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(getByText('You do not have permission to access this application.')).toBeVisible();
    expect(getByTestId('request_access')).toBeVisible();

    fireEvent.click(getByText('Request Access'));

    expect(history.location.pathname).toEqual('/access-request');
  });
});
