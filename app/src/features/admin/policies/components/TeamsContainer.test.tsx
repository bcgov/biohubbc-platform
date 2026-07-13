import { GridColDef } from '@mui/x-data-grid';
import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ITeamsContainerProps, TeamsContainer } from './TeamsContainer';

// Types for DataGrid mock
interface MockDataGridProps {
  rows: ITeam[];
  columns: GridColDef[];
  localeText?: { noRowsLabel?: string };
}

// Simple DataGrid mock - just renders rows as divs
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, localeText }: MockDataGridProps) => (
    <div data-testid="mock-data-grid">
      {rows.length === 0 ? (
        <div>{localeText?.noRowsLabel}</div>
      ) : (
        rows.map((row) => (
          <div key={row.team_id} data-testid={`row-${row.team_id}`}>
            <span>{row.name}</span>
            <span>{row.description}</span>
            <span>{row.member_count}</span>
            {/* Render actions column */}
            {columns.find((c) => c.field === 'actions')?.renderCell?.({ row } as never)}
          </div>
        ))
      )}
    </div>
  )
}));

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockTeams: ITeam[] = [
  {
    team_id: 'team-1',
    name: 'Alpha Team',
    description: 'First team',
    member_count: 1
  },
  {
    team_id: 'team-2',
    name: 'Beta Team',
    description: null,
    member_count: 2
  }
];

const mockAvailableUsers = [
  { system_user_id: 1, user_identifier: 'alice', display_name: null },
  { system_user_id: 2, user_identifier: 'bob', display_name: null }
];

const mockTeamMembers = [
  { team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice', display_name: null },
  { team_member_id: 'tm-2', system_user_id: 2, user_identifier: 'bob', display_name: null }
];

const mockCreateTeam = vi.fn();
const mockUpdateTeam = vi.fn();
const mockDeleteTeam = vi.fn();
const mockGetTeamMembers = vi.fn().mockResolvedValue({ members: mockTeamMembers });

const mockUseApi = {
  teams: {
    getAvailableUsers: vi.fn().mockResolvedValue({ users: mockAvailableUsers }),
    getTeamMembers: mockGetTeamMembers,
    createTeam: mockCreateTeam,
    updateTeam: mockUpdateTeam,
    deleteTeam: mockDeleteTeam
  }
};

const defaultProps: ITeamsContainerProps = {
  teams: mockTeams,
  rowCount: 2,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn()
};

const renderComponent = (props: Partial<ITeamsContainerProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <TeamsContainer {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('TeamsContainer', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('displays rowCount in header', async () => {
      // Step 1: Render with default props (rowCount: 2)
      const { getByText } = renderComponent();

      // Step 2: Verify dynamic rowCount appears in header
      await waitFor(() => {
        expect(getByText('(2)')).toBeVisible();
      });
    });
  });

  describe('Search', () => {
    it('displays controlled search term value', async () => {
      // Step 1: Render with searchTerm prop set
      const { getByPlaceholderText } = renderComponent({ searchTerm: 'Beta' });

      // Step 2: Verify input displays the controlled value
      await waitFor(() => {
        expect(getByPlaceholderText('Search by team name')).toHaveValue('Beta');
      });
    });

    it('calls onSearch when input changes', async () => {
      // Step 1: Create mock onSearch callback
      const mockOnSearch = vi.fn();

      // Step 2: Render with mock callback
      const { getByPlaceholderText } = renderComponent({ onSearch: mockOnSearch });

      // Step 3: Type in search input
      const input = getByPlaceholderText('Search by team name');
      fireEvent.change(input, { target: { value: 'Alpha' } });

      // Step 4: Verify callback was called with input value
      expect(mockOnSearch).toHaveBeenCalledWith('Alpha');
    });
  });

  describe('Add Button', () => {
    it('opens add dialog when clicked', async () => {
      // Step 1: Render component
      const { getByRole, getByText } = renderComponent();

      // Step 2: Click Add button
      fireEvent.click(getByRole('button', { name: /add/i }));

      // Step 3: Verify dialog opens
      await waitFor(() => {
        expect(getByText('Add Team')).toBeVisible();
      });
    });
  });

  describe('Add Team Dialog', () => {
    it('calls createTeam API with form values on submit', async () => {
      // Step 1: Setup - make createTeam return {} (simulates successful API response)
      mockCreateTeam.mockResolvedValueOnce({});

      // Step 2: Create mock refresh function to verify it's called after submit
      const mockRefresh = vi.fn();

      // Step 3: Render component with mock refresh prop
      const { getByRole, getByLabelText, queryByText } = renderComponent({ refresh: mockRefresh });

      // Step 4: Click "Add" button to open dialog
      fireEvent.click(getByRole('button', { name: /add/i }));

      // Step 5: Wait for dialog to appear (async rendering)
      await waitFor(() => {
        expect(getByLabelText('Team Name *')).toBeVisible();
      });

      // Step 6: Fill form fields
      fireEvent.change(getByLabelText('Team Name *'), { target: { value: 'New Team' } });
      fireEvent.change(getByLabelText('Description'), { target: { value: 'A new team' } });

      // Step 7: Submit form
      fireEvent.click(getByRole('button', { name: /create/i }));

      // Step 8: Verify API was called with correct params
      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith({
          name: 'New Team',
          description: 'A new team',
          system_user_ids: []
        });
      });

      // Step 9: Verify dialog closes after success
      await waitFor(() => {
        expect(queryByText('Add Team')).toBeNull();
      });

      // Step 10: Verify refresh was called after success
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Edit Team Dialog', () => {
    it('opens edit dialog with team data when Edit is clicked', async () => {
      // Step 1: Render component with mock data
      const { getByText, getAllByTitle, getByLabelText } = renderComponent();

      // Step 2: Wait for data to render
      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Step 3: Open actions menu
      fireEvent.click(getAllByTitle('Actions')[0]);

      // Step 4: Wait for menu to appear
      await waitFor(() => {
        expect(getByText('Edit team')).toBeVisible();
      });

      // Step 5: Click Edit option
      fireEvent.click(getByText('Edit team'));

      // Step 6: Verify dialog opens with pre-populated data from selected team
      await waitFor(() => {
        expect(getByText('Edit Team')).toBeVisible();
        expect(getByLabelText('Team Name *')).toHaveValue('Alpha Team');
        expect(getByLabelText('Description')).toHaveValue('First team');
      });
    });

    it('calls updateTeam API on save', async () => {
      // Step 1: Setup - make updateTeam return {} (simulates successful API response)
      mockUpdateTeam.mockResolvedValueOnce({});

      // Step 2: Create mock refresh function
      const mockRefresh = vi.fn();

      // Step 3: Render component with mock refresh prop
      const { getByText, getAllByTitle, getByLabelText, getByRole, queryByText } = renderComponent({
        refresh: mockRefresh
      });

      // Step 4: Wait for data to render
      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Step 5: Open actions menu and click Edit
      fireEvent.click(getAllByTitle('Actions')[0]);
      await waitFor(() => expect(getByText('Edit team')).toBeVisible());
      fireEvent.click(getByText('Edit team'));

      // Step 6: Wait for edit dialog to appear
      await waitFor(() => {
        expect(getByLabelText('Team Name *')).toBeVisible();
      });

      // Step 7: Update form field
      fireEvent.change(getByLabelText('Team Name *'), { target: { value: 'Updated Team' } });

      // Step 8: Submit form
      fireEvent.click(getByRole('button', { name: /save/i }));

      // Step 9: Verify API was called with correct params (id + updated values + current members)
      await waitFor(() => {
        expect(mockUpdateTeam).toHaveBeenCalledWith('team-1', {
          name: 'Updated Team',
          description: 'First team',
          system_user_ids: [1, 2]
        });
      });

      // Step 10: Verify dialog closes after success
      await waitFor(() => {
        expect(queryByText('Edit Team')).toBeNull();
      });
    });

    it('sends current member IDs on save — backend handles subtractive sync', async () => {
      // When a team has 1 member (was 2), the update payload sends [1].
      // The backend diff removes the absent member (2) — subtractive sync.
      mockGetTeamMembers.mockResolvedValueOnce({
        members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice', display_name: null }]
      });
      mockUpdateTeam.mockResolvedValueOnce({});
      const mockRefresh = vi.fn();

      const { getByText, getAllByTitle, getByLabelText, getByRole } = renderComponent({ refresh: mockRefresh });

      await waitFor(() => expect(getByText('Alpha Team')).toBeVisible());

      fireEvent.click(getAllByTitle('Actions')[0]);
      await waitFor(() => expect(getByText('Edit team')).toBeVisible());
      fireEvent.click(getByText('Edit team'));

      await waitFor(() => expect(getByLabelText('Team Name *')).toHaveValue('Alpha Team'));

      fireEvent.click(getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockUpdateTeam).toHaveBeenCalledWith('team-1', {
          name: 'Alpha Team',
          description: 'First team',
          system_user_ids: [1]
        });
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state message', async () => {
      // Step 1: Render with empty teams array
      const { getByText } = renderComponent({ teams: [], rowCount: 0 });

      // Step 2: Verify empty state message appears (from DataGrid localeText)
      await waitFor(() => {
        expect(getByText('No Teams')).toBeVisible();
      });
    });
  });
});
