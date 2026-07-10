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
});
