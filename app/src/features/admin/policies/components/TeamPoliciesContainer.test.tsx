import { fireEvent } from '@testing-library/react';
import { GridColDef } from '@mui/x-data-grid';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import type { ITeamPolicyFormValues } from './TeamPolicyForm';
import { ITeamPoliciesContainerProps, TeamPoliciesContainer } from './TeamPoliciesContainer';

interface MockDataGridProps {
  rows: ITeamPolicyDetails[];
  columns: GridColDef[];
  localeText?: { noRowsLabel?: string };
}

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
            {columns.find((c) => c.field === 'actions')?.renderCell?.({ row } as never)}
          </div>
        ))
      )}
    </div>
  )
}));

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

vi.mock('./CreateTeamPolicyDialog', () => ({
  CreateTeamPolicyDialog: ({ open, onSave }: { open: boolean; onSave: (values: ITeamPolicyFormValues) => void }) =>
    open ? (
      <div>
        <div>Add Assignment</div>
        <button
          data-testid="mock-create-assignment-save"
          onClick={() => onSave({ team_id: 'team-3', policies: ['policy-3'] })}>
          Save
        </button>
      </div>
    ) : null
}));

const mockTeamPolicies: ITeamPolicyDetails[] = [
  {
    team_policy_id: 'tp-1',
    team_id: 'team-1',
    policy_id: 'policy-1',
    record_end_date: null,
    team_name: 'Alpha Team',
    policy_name: 'Data Access Policy'
  },
  {
    team_policy_id: 'tp-2',
    team_id: 'team-2',
    policy_id: 'policy-2',
    record_end_date: null,
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
  {
    policy_id: 'policy-1',
    name: 'Data Access Policy',
    description: 'Access policy',
    status: PolicyStatus.APPROVED,
    statements: []
  },
  {
    policy_id: 'policy-2',
    name: 'Security Policy',
    description: 'Security policy',
    status: PolicyStatus.APPROVED,
    statements: []
  },
  {
    policy_id: 'policy-3',
    name: 'Admin Policy',
    description: 'Admin policy',
    status: PolicyStatus.APPROVED,
    statements: []
  }
];

const mockCreateTeamPolicies = vi.fn();
const mockDeleteTeamPolicy = vi.fn();
const mockGetTeams = vi.fn();
const mockGetPolicies = vi.fn();

const mockUseApi = {
  teamPolicies: {
    deleteTeamPolicy: mockDeleteTeamPolicy,
    createTeamPolicies: mockCreateTeamPolicies
  },
  teams: {
    getTeams: mockGetTeams
  },
  policies: {
    getPolicies: mockGetPolicies
  }
};

const defaultProps: ITeamPoliciesContainerProps = {
  teamPolicies: mockTeamPolicies,
  rowCount: 2,
  paginationModel: { page: 0, pageSize: 10 },
  setPaginationModel: vi.fn(),
  sortModel: [{ field: 'team_name', sort: 'asc' }],
  setSortModel: vi.fn(),
  refresh: vi.fn(),
  searchTerm: '',
  onSearch: vi.fn()
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
    mockGetTeams.mockResolvedValue({ teams: mockTeams });
    mockGetPolicies.mockResolvedValue({ policies: mockPolicies });
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('displays rowCount in header', async () => {
    const { getByText } = renderComponent();

    await waitFor(() => {
      expect(getByText('(2)')).toBeVisible();
    });
  });

  it('opens Add Assignment dialog when Add is clicked', async () => {
    const { getByRole, getByText } = renderComponent();

    await waitFor(() => {
      expect(getByRole('button', { name: /add/i })).toBeEnabled();
    });

    fireEvent.click(getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(getByText('Add Assignment')).toBeVisible();
    });
  });

  it('displays controlled search term value', async () => {
    const { getByPlaceholderText } = renderComponent({ searchTerm: 'Alpha' });

    await waitFor(() => {
      expect(getByPlaceholderText('Search by team or policy')).toHaveValue('Alpha');
    });
  });

  it('calls onSearch when input changes', () => {
    const mockOnSearch = vi.fn();
    const { getByPlaceholderText } = renderComponent({ onSearch: mockOnSearch });

    fireEvent.change(getByPlaceholderText('Search by team or policy'), { target: { value: 'Security' } });

    expect(mockOnSearch).toHaveBeenCalledWith('Security');
  });

  it('calls createTeamPolicies API when Add dialog is saved', async () => {
    mockCreateTeamPolicies.mockResolvedValueOnce({});
    const mockRefresh = vi.fn();

    const { getByRole, getByTestId } = renderComponent({ refresh: mockRefresh });

    await waitFor(() => {
      expect(getByRole('button', { name: /add/i })).toBeEnabled();
    });

    fireEvent.click(getByRole('button', { name: /add/i }));
    fireEvent.click(getByTestId('mock-create-assignment-save'));

    await waitFor(() => {
      expect(mockCreateTeamPolicies).toHaveBeenCalledWith('team-3', { policies: ['policy-3'] });
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows empty state message', async () => {
    const { getByText } = renderComponent({ teamPolicies: [], rowCount: 0 });

    await waitFor(() => {
      expect(getByText('No Team-Policy Assignments')).toBeVisible();
    });
  });
});
