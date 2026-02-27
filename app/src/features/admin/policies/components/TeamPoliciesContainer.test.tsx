import { fireEvent } from '@testing-library/react';
import { GridColDef } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ITeamPoliciesContainerProps, TeamPoliciesContainer } from './TeamPoliciesContainer';

// Types for DataGrid mock
interface MockDataGridProps {
  rows: ITeamPolicyDetails[];
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
          <div key={row.team_policy_id} data-testid={`row-${row.team_policy_id}`}>
            <span>{row.team_name}</span>
            <span>{row.policy_name}</span>
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

const mockTeamPolicies: ITeamPolicyDetails[] = [
  {
    team_policy_id: 'tp-1',
    team_id: 'team-1',
    policy_id: 'policy-1',
    team_name: 'Alpha Team',
    policy_name: 'Data Access Policy'
  },
  {
    team_policy_id: 'tp-2',
    team_id: 'team-2',
    policy_id: 'policy-2',
    team_name: 'Beta Team',
    policy_name: 'Security Policy'
  }
];

const mockTeams: ITeam[] = [
  { team_id: 'team-1', name: 'Alpha Team', description: 'First team', member_count: 0 },
  { team_id: 'team-2', name: 'Beta Team', description: 'Second team', member_count: 0 },
  { team_id: 'team-3', name: 'Gamma Team', description: 'Third team', member_count: 0 }
];

const mockPolicies: IPolicy[] = [
  { policy_id: 'policy-1', name: 'Data Access Policy', description: 'Access policy', statements: [] },
  { policy_id: 'policy-2', name: 'Security Policy', description: 'Security policy', statements: [] },
  { policy_id: 'policy-3', name: 'Admin Policy', description: 'Admin policy', statements: [] }
];

const mockCreateTeamPolicy = vi.fn();
const mockDeleteTeamPolicy = vi.fn();

const mockUseApi = {
  teamPolicies: {
    createTeamPolicy: mockCreateTeamPolicy,
    deleteTeamPolicy: mockDeleteTeamPolicy
  }
};

const defaultProps: ITeamPoliciesContainerProps = {
  teamPolicies: mockTeamPolicies,
  rowCount: 2,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'team_name', sort: 'asc' }],
  setSortModel: vi.fn(),
  selectedTeam: null,
  selectedPolicy: null,
  refresh: vi.fn()
};

const renderComponent = (props: Partial<ITeamPoliciesContainerProps> = {}) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <TeamPoliciesContainer {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('TeamPoliciesContainer', () => {
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

    it('shows team-specific header when team is selected', async () => {
      // Step 1: Render with selectedTeam prop
      const { getByText } = renderComponent({ selectedTeam: mockTeams[0] });

      // Step 2: Verify header shows team-specific text
      await waitFor(() => {
        expect(getByText('Policies for "Alpha Team"')).toBeVisible();
      });
    });

    it('shows policy-specific header when policy is selected', async () => {
      // Step 1: Render with selectedPolicy prop
      const { getByText } = renderComponent({ selectedPolicy: mockPolicies[0] });

      // Step 2: Verify header shows policy-specific text
      await waitFor(() => {
        expect(getByText('Teams with "Data Access Policy"')).toBeVisible();
      });
    });

    it('shows combined header when both team and policy are selected', async () => {
      // Step 1: Render with both selectedTeam and selectedPolicy props
      const { getByText } = renderComponent({
        selectedTeam: mockTeams[0],
        selectedPolicy: mockPolicies[0]
      });

      // Step 2: Verify header shows combined assignment text
      await waitFor(() => {
        expect(getByText('Assignment: Alpha Team + Data Access Policy')).toBeVisible();
      });
    });
  });

  describe('Assign Button', () => {
    it('does not show Assign button when no selection', async () => {
      // Step 1: Render with no selection (default props)
      const { queryByRole } = renderComponent();

      // Step 2: Verify Assign button is NOT visible
      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('does not show Assign button when only team is selected', async () => {
      // Step 1: Render with only selectedTeam (no policy)
      const { queryByRole } = renderComponent({ selectedTeam: mockTeams[0] });

      // Step 2: Verify Assign button is NOT visible (needs both)
      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('does not show Assign button when only policy is selected', async () => {
      // Step 1: Render with only selectedPolicy (no team)
      const { queryByRole } = renderComponent({ selectedPolicy: mockPolicies[0] });

      // Step 2: Verify Assign button is NOT visible (needs both)
      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('shows Assign button when both selected and assignment does not exist', async () => {
      // Step 1: Render with team + policy that are NOT already assigned
      const { getByRole } = renderComponent({
        selectedTeam: mockTeams[2], // Gamma Team - not in mockTeamPolicies
        selectedPolicy: mockPolicies[2] // Admin Policy - not in mockTeamPolicies
      });

      // Step 2: Verify Assign button IS visible (can create new assignment)
      await waitFor(() => {
        expect(getByRole('button', { name: /assign/i })).toBeVisible();
      });
    });

    it('does not show Assign button when assignment already exists', async () => {
      // Step 1: Render with team + policy that ARE already assigned
      const { queryByRole } = renderComponent({
        selectedTeam: mockTeams[0], // Alpha Team
        selectedPolicy: mockPolicies[0] // Data Access Policy - already assigned
      });

      // Step 2: Verify Assign button is NOT visible (duplicate prevention)
      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('calls createTeamPolicy API when Assign is clicked', async () => {
      // Step 1: Setup - make createTeamPolicy return {} (simulates successful API response)
      mockCreateTeamPolicy.mockResolvedValueOnce({});

      // Step 2: Create mock refresh function to verify it's called after submit
      const mockRefresh = vi.fn();

      // Step 3: Render component with selected team + policy (enables Assign button)
      const { getByRole } = renderComponent({
        selectedTeam: mockTeams[2],
        selectedPolicy: mockPolicies[2],
        refresh: mockRefresh
      });

      // Step 4: Wait for Assign button to appear
      await waitFor(() => {
        expect(getByRole('button', { name: /assign/i })).toBeVisible();
      });

      // Step 5: Click Assign button
      fireEvent.click(getByRole('button', { name: /assign/i }));

      // Step 6: Verify API was called with correct params
      await waitFor(() => {
        expect(mockCreateTeamPolicy).toHaveBeenCalledWith({
          team_id: 'team-3',
          policy_id: 'policy-3'
        });
      });

      // Step 7: Verify refresh was called after success
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state message', async () => {
      // Step 1: Render with empty teamPolicies array
      const { getByText } = renderComponent({ teamPolicies: [], rowCount: 0 });

      // Step 2: Verify empty state message appears (from DataGrid localeText)
      await waitFor(() => {
        expect(getByText('No Team-Policy Assignments')).toBeVisible();
      });
    });
  });
});
