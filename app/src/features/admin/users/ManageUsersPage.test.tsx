import { fireEvent } from '@testing-library/react';
import { cleanup, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { MemoryRouter } from 'react-router-dom';
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
vi.mock('hooks/useAuthStateContext');

const mockBiohubApi = useApi as Mock;

const mockUseApi = {
  contributors: {
    listContributors: vi.fn()
  },
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
    vi.mocked(useAuthStateContext).mockReturnValue({
      biohubUserWrapper: { roleNames: ['System Administrator'] }
    } as ReturnType<typeof useAuthStateContext>);
    mockUseApi.contributors.listContributors.mockResolvedValue({
      contributors: [],
      pagination: { total: 30, current_page: 1, last_page: 3 }
    });
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
  it('shows only Users and Contributors tabs and resets pagination when returning', async () => {
    const { getByRole, getAllByRole } = renderContainer();
    expect(getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Users', 'Contributors']);
    fireEvent.click(getByRole('tab', { name: 'Contributors' }));
    await waitFor(() =>
      expect(mockUseApi.contributors.listContributors).toHaveBeenCalledWith(
        { keyword: '' },
        expect.objectContaining({ page: 1 })
      )
    );
    fireEvent.click(getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(mockUseApi.contributors.listContributors).toHaveBeenLastCalledWith(
        { keyword: '' },
        expect.objectContaining({ page: 2 })
      )
    );
    fireEvent.click(getByRole('tab', { name: 'Users' }));
    await waitFor(() => expect(getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true'));
    fireEvent.click(getByRole('tab', { name: 'Contributors' }));
    await waitFor(() =>
      expect(mockUseApi.contributors.listContributors).toHaveBeenLastCalledWith(
        { keyword: '' },
        expect.objectContaining({ page: 1 })
      )
    );
  });

  it('keeps Users available while hiding contributor tabs for data administrators', async () => {
    vi.mocked(useAuthStateContext).mockReturnValue({
      biohubUserWrapper: { roleNames: ['Data Administrator'] }
    } as ReturnType<typeof useAuthStateContext>);
    const { getByRole, queryByRole } = renderContainer();
    await waitFor(() => expect(getByRole('tab', { name: 'Users' })).toBeVisible());
    expect(queryByRole('tab', { name: 'Contributors' })).not.toBeInTheDocument();
    expect(queryByRole('tab', { name: 'Contributor Users' })).not.toBeInTheDocument();
  });
});
