import { AuthStateContext } from 'contexts/authStateContext';
import { createMemoryHistory } from 'history';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import { Router } from 'react-router-dom';
import { getMockAuthState, SystemAdminAuthState, SystemUserAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import Header from './Header';

const history = createMemoryHistory();

describe('Header', () => {
  it('renders correctly with IDIR system admin role', () => {
    const mockHasSystemRole = jest.fn();

    mockHasSystemRole.mockReturnValueOnce(true); // Return true when the `Manage Users` secure link is parsed

    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <Header />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(getByText('Home')).toBeVisible();
    expect(getByText('Find Datasets')).toBeVisible();
    expect(getByText('Map Search')).toBeVisible();
    expect(getByText('Manage Users')).toBeVisible();
  });

  it('renders the username and logout button', () => {
    const authState = getMockAuthState({
      base: SystemAdminAuthState,
      overrides: { keycloakWrapper: { getIdentitySource: () => SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS } }
    });

    const { getByTestId, getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <Router history={history}>
          <Header />
        </Router>
      </AuthStateContext.Provider>
    );

    expect(getByTestId('menu_log_out')).toBeVisible();

    expect(getByText('BCeID / testusername')).toBeVisible();
  });

  describe('Log Out', () => {
    it('redirects to the `/logout` page', async () => {
      const authState = getMockAuthState({ base: SystemUserAuthState });

      const { getByTestId } = render(
        <AuthStateContext.Provider value={authState}>
          <Router history={history}>
            <Header />
          </Router>
        </AuthStateContext.Provider>
      );

      expect(getByTestId('menu_log_out')).toHaveAttribute('href', '/logout');
    });
  });
});
