import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { createMemoryHistory } from 'history';
import { useApi } from 'hooks/useApi';
import React from 'react';
import { Router } from 'react-router';
import ManageUsersPage from './ManageUsersPage';

const history = createMemoryHistory();

const renderContainer = () => {
  return render(
    <Router history={history}>
      <ManageUsersPage />
    </Router>
  );
};

jest.mock('../../../hooks/useApi');
const mockUseApi = {
  admin: {
    getAccessRequests: jest.fn()
  },
  user: {
    getUsersList: jest.fn()
  }
};
const mockBiohubApi = (useApi as unknown as jest.Mock<typeof mockUseApi>).mockReturnValue(mockUseApi);

describe('ManageUsersPage', () => {
  beforeEach(() => {
    // clear mocks before each test
    mockBiohubApi().admin.getAccessRequests.mockClear();
    mockBiohubApi().user.getUsersList.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the main page content correctly', async () => {
    mockBiohubApi().admin.getAccessRequests.mockReturnValue([]);
    mockBiohubApi().user.getUsersList.mockReturnValue([]);

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Manage Users')).toBeVisible();
    });
  });

  it('renders the access requests and active users component', async () => {
    mockBiohubApi().admin.getAccessRequests.mockReturnValue([]);
    mockBiohubApi().user.getUsersList.mockReturnValue([]);

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No Active Users')).toBeVisible();
    });
  });
});
