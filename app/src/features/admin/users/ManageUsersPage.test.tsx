import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import ManageUsersPage from './ManageUsersPage';

const renderContainer = (queryClient?: QueryClient) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ManageUsersPage />
    </MemoryRouter>,
    { queryClient }
  );
};

vi.mock('../../../hooks/useApi');

const mocks = vi.hoisted(() => ({
  setErrorDialog: vi.fn(),
  setSnackbar: vi.fn(),
  newUsers: [] as { userIdentifier: string; userGuid: string; identitySource: string; systemRole: number }[]
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({
    setErrorDialog: mocks.setErrorDialog,
    setSnackbar: mocks.setSnackbar,
    setYesNoDialog: vi.fn()
  })
}));
// The add-users form is exercised by its own suite; here the dialog submits the rows each test sets.
vi.mock('components/dialog/EditDialog', () => ({
  EditDialog: (props: { open: boolean; onSave: (values: unknown) => void }) =>
    props.open ? <button onClick={() => props.onSave({ systemUsers: mocks.newUsers })}>Save users</button> : null
}));

const newUser = (userGuid: string, systemRole = 1) => ({
  userIdentifier: `user-${userGuid}`,
  userGuid,
  identitySource: 'IDIR',
  systemRole
});

const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  user: {
    getUsersList: vi.fn(),
    getRoles: vi.fn(),
    updateSystemUser: vi.fn(),
    updateSystemUserRoles: vi.fn()
  },
  admin: {
    addSystemUser: vi.fn()
  }
};

describe('ManageUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApi.user.getRoles.mockResolvedValue([]);
    mockUseApi.user.getUsersList.mockResolvedValue({
      users: [],
      pagination: {
        total: 0,
        current_page: 1,
        last_page: 1,
        per_page: 10
      }
    });
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the main page content correctly', async () => {
    const { getByRole } = renderContainer();

    await waitFor(() => {
      expect(getByRole('heading', { name: 'Administrative' })).toBeVisible();
      expect(getByRole('tab', { name: 'Users' })).toBeVisible();
    });
  });

  it('renders the access requests and active users component', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No users')).toBeVisible();
    });
  });

  it('adds different users together, and rows sharing a GUID in any case one after another', async () => {
    const pending: (() => void)[] = [];
    mockUseApi.admin.addSystemUser.mockImplementation(
      () => new Promise<boolean>((resolve) => pending.push(() => resolve(true)))
    );
    mocks.newUsers = [newUser('a', 1), newUser('b', 1), { ...newUser('A', 2), identitySource: 'BCEIDBASIC' }];
    renderContainer();

    fireEvent.click(await screen.findByRole('button', { name: 'Add Users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save users' }));

    await waitFor(() => expect(mockUseApi.admin.addSystemUser).toHaveBeenCalledTimes(2));
    expect(mockUseApi.admin.addSystemUser.mock.calls.map((call) => [call[1], call[3]])).toEqual([
      ['a', 1],
      ['b', 1]
    ]);

    pending[0]();
    await waitFor(() => expect(mockUseApi.admin.addSystemUser).toHaveBeenCalledTimes(3));
    expect(mockUseApi.admin.addSystemUser.mock.calls[2]).toEqual(['user-A', 'A', 'BCEIDBASIC', 2]);
  });

  it('lists the users that were added when another fails, and reports the failure', async () => {
    mockUseApi.admin.addSystemUser.mockImplementation((_identifier: string, userGuid: string) =>
      userGuid === 'b' ? Promise.reject(new Error('Duplicate user')) : Promise.resolve(true)
    );
    mocks.newUsers = [newUser('a'), newUser('b')];
    renderContainer();
    await waitFor(() => expect(mockUseApi.user.getUsersList).toHaveBeenCalledOnce());

    fireEvent.click(await screen.findByRole('button', { name: 'Add Users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save users' }));

    await waitFor(() => expect(mocks.setErrorDialog).toHaveBeenCalledWith(expect.objectContaining({ open: true })));
    await waitFor(() => expect(mockUseApi.user.getUsersList).toHaveBeenCalledTimes(2));
    expect(mocks.setSnackbar).not.toHaveBeenCalled();
  });

  it('counts the users added, not the rows, in the success message', async () => {
    mockUseApi.admin.addSystemUser.mockResolvedValue(true);
    mocks.newUsers = [newUser('a', 1), newUser('a', 2)];
    renderContainer();

    fireEvent.click(await screen.findByRole('button', { name: 'Add Users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save users' }));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledOnce());
    render(mocks.setSnackbar.mock.calls[0][0].snackbarMessage);
    expect(screen.getByText('1 system user added.')).toBeVisible();
  });

  it("drops the signed-in user's cached record after a user change, since their own roles may have changed", async () => {
    mockUseApi.admin.addSystemUser.mockResolvedValue(true);
    mocks.newUsers = [newUser('a', 1)];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['user', 'self', 'subject-1'], {
      system_user_id: 1,
      role_names: ['System Administrator']
    });
    renderContainer(queryClient);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save users' }));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(['user', 'self', 'subject-1'])).toBeUndefined();
  });
});
