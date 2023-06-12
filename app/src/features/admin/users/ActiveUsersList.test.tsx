import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import { Router } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import ActiveUsersList, { IActiveUsersListProps } from './ActiveUsersList';

const history = createMemoryHistory();

const renderContainer = (props: IActiveUsersListProps) => {
  return render(
    <Router history={history}>
      <ActiveUsersList {...props} />
    </Router>
  );
};

jest.mock('../../../hooks/useApi');
const mockBiohubApi = useApi as jest.Mock;

const mockUseApi = {
  user: {
    getRoles: jest.fn()
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
    const mockGetUsers = jest.fn();
    const { getByText } = renderContainer({
      activeUsers: [],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByText('No Active Users')).toBeVisible();
    });
  });

  it('shows a table row for an active user with all fields having values', async () => {
    const mockGetUsers = jest.fn();

    const { getByText } = renderContainer({
      activeUsers: [
        {
          id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          user_record_end_date: '2020-10-10',
          role_names: ['role 1', 'role 2']
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
    const mockGetUsers = jest.fn();
    const { getByTestId } = renderContainer({
      activeUsers: [
        {
          id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          user_record_end_date: '2020-10-10',
          role_names: []
        }
      ],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByTestId('custom-menu-button-Noassignedrole')).toBeInTheDocument();
    });
  });

  it('renders the add new users button correctly', async () => {
    const mockGetUsers = jest.fn();
    const { getByTestId } = renderContainer({
      activeUsers: [],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByTestId('invite-system-users-button')).toBeVisible();
    });
  });
});
