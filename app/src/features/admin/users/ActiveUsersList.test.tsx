import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import ActiveUsersList, { IActiveUsersListProps } from './ActiveUsersList';

const defaultProps: IActiveUsersListProps = {
  rows: [],
  rowCount: 0,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn<(model: GridPaginationModel) => void>(),
  sortModel: [{ field: 'user_identifier', sort: 'asc' }],
  setSortModel: vi.fn<(model: GridSortModel) => void>(),
  systemRoles: [],
  searchTerm: '',
  onSearch: vi.fn(),
  onAddUsers: vi.fn(),
  rowActions: {
    onChangeRole: vi.fn(),
    onBlockUser: vi.fn(),
    onActivateUser: vi.fn()
  }
};

const renderContainer = (props?: Partial<IActiveUsersListProps>) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ActiveUsersList {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('ActiveUsersList', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows `No users` when there are no users', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No users')).toBeVisible();
    });
  });

  it('shows a table row for an active user with all fields having values', async () => {
    const { getByText } = renderContainer({
      rows: [
        {
          system_user_id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          record_end_date: null,
          identity_source: 'idir',
          role_ids: [1, 2],
          role_names: ['role 1', 'role 2'],
          display_name: null,
          email: null
        }
      ],
      rowCount: 1
    });

    await waitFor(() => {
      expect(getByText('username')).toBeVisible();
      expect(getByText('Active')).toBeVisible();
      expect(getByText('role 1, role 2')).toBeVisible();
    });
  });

  it('shows a table row for a blocked user', async () => {
    const { getByText } = renderContainer({
      rows: [
        {
          system_user_id: 1,
          user_identifier: 'blocked-user',
          user_guid: 'user-guid',
          record_end_date: '2020-10-10',
          identity_source: 'idir',
          role_ids: [1],
          role_names: ['role 1'],
          display_name: null,
          email: null
        }
      ],
      rowCount: 1
    });

    await waitFor(() => {
      expect(getByText('blocked-user')).toBeVisible();
      expect(getByText('Blocked')).toBeVisible();
    });
  });

  it('shows a table row for a user with no assigned role', async () => {
    const { getByTestId } = renderContainer({
      rows: [
        {
          system_user_id: 1,
          user_identifier: 'username',
          user_guid: 'user-guid',
          record_end_date: null,
          identity_source: 'idir',
          role_ids: [],
          role_names: [],
          display_name: null,
          email: null
        }
      ],
      rowCount: 1
    });

    await waitFor(() => {
      expect(getByTestId('custom-menu-button-Noassignedrole')).toBeInTheDocument();
    });
  });

  it('renders the add users button', async () => {
    const { getByTestId } = renderContainer();

    await waitFor(() => {
      expect(getByTestId('users-add-button')).toBeVisible();
    });
  });
});
