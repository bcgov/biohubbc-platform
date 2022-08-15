import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router';
import ActiveUsersList, { IActiveUsersListProps } from './ActiveUsersList';
import { useApi } from 'hooks/useApi';

const history = createMemoryHistory();

jest.mock('../../../hooks/useApi');
const mockUseApi = {
  user: {
    getRoles: jest.fn()
  }
};

const mockBiohubApi = (useApi as unknown as jest.Mock<typeof mockUseApi>).mockReturnValue(mockUseApi);

const renderContainer = (props: IActiveUsersListProps) => {
  return render(
    <Router history={history}>
      <ActiveUsersList {...props} />
    </Router>
  );
};

describe('ActiveUsersList', () => {
  beforeEach(() => {
    // clear mocks before each test
    mockBiohubApi().user.getRoles.mockClear();
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
          user_record_end_date: '2020-10-10',
          role_names: []
        }
      ],
      refresh: mockGetUsers
    });

    await waitFor(() => {
      expect(getByTestId('custom-menu-button-NotApplicable')).toBeInTheDocument();
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
