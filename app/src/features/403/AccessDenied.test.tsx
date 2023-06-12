import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import { getMockAuthState, SystemUserAuthState, UnauthenticatedUserAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import AccessDenied from './AccessDenied';

describe('AccessDenied', () => {
  it('redirects to `/` when user is not authenticated', () => {
    const authState = getMockAuthState({ base: UnauthenticatedUserAuthState });

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
      base: SystemUserAuthState,
      overrides: { keycloakWrapper: { hasLoadedAllUserInfo: false } }
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

  it('renders correctly when the user is authenticated', () => {
    const history = createMemoryHistory();

    history.push('/forbidden');

    const authState = getMockAuthState({ base: SystemUserAuthState });

    const { getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <AccessDenied />
        </Router>
      </AuthStateContext.Provider>
    );

    // does not change location
    expect(history.location.pathname).toEqual('/forbidden');

    expect(getByText('You do not have permission to access this page.')).toBeVisible();
  });
});
