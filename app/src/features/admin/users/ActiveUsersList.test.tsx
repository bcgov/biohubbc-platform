import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import ActiveUsersList, { IActiveUsersListProps } from './ActiveUsersList';

const renderContainer = (props: IActiveUsersListProps) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ActiveUsersList {...props} />
    </MemoryRouter>
  );
};

vi.mock('../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  user: {
    getRoles: vi.fn()
  }
};

describe('ActiveUsersList', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows `No Active Users` when there are no active users', async () => {
    const mockGetUsers = vi.fn();
    const { getByText } = renderContainer({
      activeUsers: [],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByText('No Active Users')).toBeVisible();
    });
  });

  it('shows a table row for an active user with all fields having values', async () => {
    const mockGetUsers = vi.fn();

    const { getByText } = renderContainer({
      activeUsers: [
        {
          system_user_id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          record_end_date: '2020-10-10',
          identity_source: '',
          role_ids: [1, 2],
          role_names: ['role 1', 'role 2'],
          display_name: null,
          email: null
        }
      ],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByText('username')).toBeVisible();
      expect(getByText('role 1, role 2')).toBeVisible();
    });
  });

  it('shows a table row for an active user with fields not having values', async () => {
    const mockGetUsers = vi.fn();
    const { getByTestId } = renderContainer({
      activeUsers: [
        {
          system_user_id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          record_end_date: '2020-10-10',
          identity_source: '',
          role_ids: [],
          role_names: [],
          display_name: null,
          email: null
        }
      ],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByTestId('custom-menu-button-Noassignedrole')).toBeInTheDocument();
    });
  });

  it('renders the add new users button correctly', async () => {
    const mockGetUsers = vi.fn();
    const { getByTestId } = renderContainer({
      activeUsers: [],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByTestId('invite-system-users-button')).toBeVisible();
    });
  });
});
