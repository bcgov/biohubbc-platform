import { cleanup, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import ManageUsersPage from './ManageUsersPage';

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ManageUsersPage />
    </MemoryRouter>
  );
};

vi.mock('../../../hooks/useApi');

const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  user: {
    getUsersList: vi.fn()
  }
};

describe('ManageUsersPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the main page content correctly', async () => {
    mockUseApi.user.getUsersList.mockReturnValue([]);

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Manage Users')).toBeVisible();
    });
  });

  it('renders the access requests and active users component', async () => {
    mockUseApi.user.getUsersList.mockReturnValue([]);

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No Active Users')).toBeVisible();
    });
  });
});
