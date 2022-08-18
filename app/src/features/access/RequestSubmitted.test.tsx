import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router';
import { getMockAuthState } from 'test-helpers/auth-helpers';
import { fireEvent, render, waitFor } from 'test-helpers/test-utils';
import RequestSubmitted from './RequestSubmitted';

describe('RequestSubmitted', () => {
  it('renders a spinner when `hasLoadedAllUserInfo` is false', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        hasLoadedAllUserInfo: false,
        systemRoles: [],
        hasAccessRequest: false,

        keycloak: {},
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        firstName: 'testfirst',
        lastName: 'testlast',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/access-request');

    const { queryByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <RequestSubmitted />
        </Router>
      </AuthStateContext.Provider>
    );

    // does not change location
    expect(history.location.pathname).toEqual('/access-request');

    // renders a spinner
    expect(queryByText('Access Request Submitted')).toEqual(null);
  });

  it('redirects to `/` when user has at least 1 system role', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        hasLoadedAllUserInfo: true,
        systemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        hasAccessRequest: false,

        keycloak: {},
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        firstName: 'testfirst',
        lastName: 'testlast',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/access-request');

    render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <RequestSubmitted />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(history.location.pathname).toEqual('/');
  });

  it('redirects to `/` when user has no pending access request', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        hasLoadedAllUserInfo: true,
        systemRoles: [],
        hasAccessRequest: false,

        keycloak: {},
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        firstName: 'testfirst',
        lastName: 'testlast',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/access-request');

    render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <RequestSubmitted />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(history.location.pathname).toEqual('/');
  });

  it('renders correctly when user has no role but has a pending access requests', () => {
    const authState = getMockAuthState({
      keycloakWrapper: {
        hasLoadedAllUserInfo: true,
        systemRoles: [],
        hasAccessRequest: true,

        keycloak: {},
        getUserIdentifier: jest.fn(),
        hasSystemRole: jest.fn(),
        getIdentitySource: jest.fn(),
        username: 'testusername',
        displayName: 'testdisplayname',
        email: 'test@email.com',
        firstName: 'testfirst',
        lastName: 'testlast',
        refresh: () => {}
      }
    });

    const history = createMemoryHistory();

    history.push('/access-request');

    const { getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <RequestSubmitted />
        </Router>
      </AuthStateContext.Provider>
    );

    // does not change location
    expect(history.location.pathname).toEqual('/access-request');

    expect(getByText('Log Out')).toBeVisible();

    // renders the component in full
    expect(getByText('Access Request Submitted')).toBeVisible();
  });

  describe('Log Out', () => {
    const history = createMemoryHistory();

    it('should redirect to `/logout`', async () => {
      const authState = getMockAuthState({
        keycloakWrapper: {
          hasLoadedAllUserInfo: true,
          systemRoles: [],
          hasAccessRequest: true,

          keycloak: {},
          getUserIdentifier: jest.fn(),
          hasSystemRole: jest.fn(),
          getIdentitySource: jest.fn(),
          username: 'testusername',
          displayName: 'testdisplayname',
          email: 'test@email.com',
          firstName: 'testfirst',
          lastName: 'testlast',
          refresh: () => {}
        }
      });

      const { getByTestId } = render(
        <AuthStateContext.Provider value={authState}>
          <Router history={history}>
            <RequestSubmitted />
          </Router>
        </AuthStateContext.Provider>
      );

      fireEvent.click(getByTestId('logout-button'));

      await waitFor(() => {
        expect(history.location.pathname).toEqual('/logout');
      });
    });
  });
});
