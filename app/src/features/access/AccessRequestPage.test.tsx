import { AuthStateContext } from 'contexts/authStateContext';
import { DialogContextProvider } from 'contexts/dialogContext';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { Router } from 'react-router';
import { getMockAuthState } from 'test-helpers/auth-helpers';
import { cleanup, fireEvent, render, waitFor, within } from 'test-helpers/test-utils';
import AccessRequestPage from './AccessRequestPage';

const history = createMemoryHistory();

jest.mock('../../hooks/useApi');

const mockBiohubApi = useApi as jest.Mock;

const mockUseApi = {
  admin: {
    createAdministrativeActivity: jest.fn()
  },
  user: {
    getRoles: jest.fn()
  }
};

const renderContainer = () => {
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
      firstName: 'testfirst',
      lastName: 'testlast',
      refresh: () => {}
    }
  });

  return render(
    <AuthStateContext.Provider value={authState as any}>
      <DialogContextProvider>
        <Router history={history}>
          <AccessRequestPage />
        </Router>
      </DialogContextProvider>
    </AuthStateContext.Provider>
  );
};

describe('AccessRequestPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(
        getByText('You will need to provide some additional details before accessing this application.')
      ).toBeVisible();
    });
  });

  describe('Log Out', () => {
    const history = createMemoryHistory();

    it('should redirect to `/logout`', async () => {
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
          firstName: 'testfirst',
          lastName: 'testlast',
          refresh: () => {}
        }
      });

      const { getByText } = render(
        <AuthStateContext.Provider value={authState as any}>
          <Router history={history}>
            <AccessRequestPage />
          </Router>
        </AuthStateContext.Provider>
      );

      fireEvent.click(getByText('Log out'));

      await waitFor(() => {
        expect(history.location.pathname).toEqual('/logout');
      });
    });
  });

  it('processes a successful request submission', async () => {
    mockUseApi.admin.createAdministrativeActivity.mockResolvedValue({
      id: 1
    });

    mockUseApi.user.getRoles.mockResolvedValue([{
      system_role_id: 1,
      name: 'System Administrator'
    }]);

    const { getByText, getAllByRole, getByRole } = renderContainer();

    fireEvent.mouseDown(getAllByRole('button')[0]);

    const systemRoleListbox = within(getByRole('listbox'));

    await waitFor(() => {
      expect(systemRoleListbox.getByText('System Administrator')).toBeInTheDocument();
    });

    fireEvent.click(systemRoleListbox.getByText('System Administrator'));

    fireEvent.click(getByText('Submit Request'));

    await waitFor(() => {
      expect(history.location.pathname).toEqual('/request-submitted');
    });
  });

  it('takes the user to the request-submitted page immediately if they already have an access request', async () => {
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
        username: '',
        displayName: '',
        email: '',
        firstName: '',
        lastName: '',
        refresh: () => {}
      }
    });

    render(
      <AuthStateContext.Provider value={authState as any}>
        <Router history={history}>
          <AccessRequestPage />
        </Router>
      </AuthStateContext.Provider>
    );

    await waitFor(() => {
      expect(history.location.pathname).toEqual('/request-submitted');
    });
  });

  it('shows error dialog with api error message when submission fails', async () => {
    mockUseApi.admin.createAdministrativeActivity.mockImplementationOnce(() =>
      Promise.reject(new Error('API Error is Here'))
    );

    mockUseApi.user.getRoles.mockResolvedValue([{
      system_role_id: 1,
      name: 'System Administrator'
    }]);

    const { getByText, getAllByRole, getByRole, queryByText } = renderContainer();


    fireEvent.mouseDown(getAllByRole('button')[0]);

    const systemRoleListbox = within(getByRole('listbox'));

    await waitFor(() => {
      expect(systemRoleListbox.getByText('System Administrator', {exact: false})).toBeInTheDocument();
    });

    fireEvent.click(systemRoleListbox.getByText('System Administrator'));

    fireEvent.click(getByText('Submit Request'));

    await waitFor(() => {
      expect(queryByText('API Error is Here')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Ok'));

    await waitFor(() => {
      expect(queryByText('API Error is Here')).toBeNull();
    });
  });

  it('shows error dialog with default error message when response from createAdministrativeActivity is invalid', async () => {
    mockUseApi.admin.createAdministrativeActivity.mockResolvedValue({
      id: null
    });

    mockUseApi.user.getRoles.mockResolvedValue([{
      system_role_id: 1,
      name: 'System Administrator'
    }]);

    const { getByText, getAllByRole, getByRole, queryByText } = renderContainer();

    fireEvent.mouseDown(getAllByRole('button')[0]);

    const systemRoleListbox = within(getByRole('listbox'));

    await waitFor(() => {
      expect(systemRoleListbox.getByText('System Administrator')).toBeInTheDocument();
    });

    fireEvent.click(systemRoleListbox.getByText('System Administrator'));

    fireEvent.click(getByText('Submit Request'));

    await waitFor(() => {
      expect(queryByText('The response from the server was null.')).toBeInTheDocument();
    });

    // Get the backdrop, then get the firstChild because this is where the event listener is attached
    //@ts-ignore
    fireEvent.click(getAllByRole('presentation')[0].firstChild);

    await waitFor(() => {
      expect(queryByText('The response from the server was null.')).toBeNull();
    });
  });
});
