import { fireEvent, waitFor } from '@testing-library/react';
import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { AuthStateContext } from 'contexts/authStateContext';
import { MemoryRouter } from 'react-router-dom';
import { getMockAuthState, SystemAdminAuthState, SystemUserAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import Header from './Header';

describe('Header', () => {
  it('renders correctly with system admin role (IDIR)', () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/']}>
          <Header />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    expect(getByTestId('submissions-header-item')).toBeVisible();
    expect(getByTestId('tickets-header-item')).toBeVisible();
    expect(getByTestId('manage-users-header-item')).toBeVisible();
    expect(getByTestId('security-header-item')).toBeVisible();
  });

  it('renders correctly with system admin role (BCeID Business)', () => {
    const authState = getMockAuthState({
      base: SystemAdminAuthState,
      overrides: { biohubUserWrapper: { identitySource: SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS } }
    });

    const { getByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/']}>
          <Header />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    expect(getByTestId('submissions-header-item')).toBeVisible();
    expect(getByTestId('tickets-header-item')).toBeVisible();
    expect(getByTestId('manage-users-header-item')).toBeVisible();
    expect(getByTestId('security-header-item')).toBeVisible();
  });

  it('renders correctly with system admin role (BCeID Basic)', () => {
    const authState = getMockAuthState({
      base: SystemAdminAuthState,
      overrides: { biohubUserWrapper: { identitySource: SYSTEM_IDENTITY_SOURCE.BCEID_BASIC } }
    });

    const { getByTestId } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/']}>
          <Header />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    expect(getByTestId('submissions-header-item')).toBeVisible();
    expect(getByTestId('tickets-header-item')).toBeVisible();
    expect(getByTestId('manage-users-header-item')).toBeVisible();
    expect(getByTestId('security-header-item')).toBeVisible();
  });

  it('renders the username and logout button', () => {
    const authState = getMockAuthState({
      base: SystemAdminAuthState,
      overrides: { biohubUserWrapper: { identitySource: SYSTEM_IDENTITY_SOURCE.BCEID_BASIC } }
    });

    const { getByTestId, getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/']}>
          <Header />
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    expect(getByTestId('menu_log_out')).toBeVisible();

    expect(getByText('BCeID Basic/admin-username')).toBeVisible();
  });

  describe('Log out', () => {
    describe('expanded menu button', () => {
      it('calls logout', async () => {
        const signoutRedirectStub = vi.fn();

        const authState = getMockAuthState({
          base: SystemUserAuthState,
          overrides: { auth: { signoutRedirect: signoutRedirectStub } }
        });

        const { getByTestId } = render(
          <AuthStateContext.Provider value={authState}>
            <MemoryRouter initialEntries={['/']}>
              <Header />
            </MemoryRouter>
          </AuthStateContext.Provider>
        );

        const logoutButton = getByTestId('menu_log_out');

        expect(logoutButton).toBeInTheDocument();

        fireEvent.click(logoutButton);

        await waitFor(() => {
          expect(signoutRedirectStub).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('collapsed menu button', () => {
      it('calls logout', async () => {
        const signoutRedirectStub = vi.fn();

        const authState = getMockAuthState({
          base: SystemUserAuthState,
          overrides: { auth: { signoutRedirect: signoutRedirectStub } }
        });

        const { getByTestId } = render(
          <AuthStateContext.Provider value={authState}>
            <MemoryRouter initialEntries={['/']}>
              <Header />
            </MemoryRouter>
          </AuthStateContext.Provider>
        );

        const logoutButton = getByTestId('collapsed_menu_log_out');

        expect(logoutButton).toBeInTheDocument();

        fireEvent.click(logoutButton);

        await waitFor(() => {
          expect(signoutRedirectStub).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
