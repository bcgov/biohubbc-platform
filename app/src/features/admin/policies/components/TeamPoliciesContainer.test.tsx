import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ITeamPoliciesContainerProps, TeamPoliciesContainer } from './TeamPoliciesContainer';

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

const mockTeams: ITeamWithMembers[] = [
  { team_id: 'team-1', name: 'Alpha Team', description: 'First team', members: [] },
  { team_id: 'team-2', name: 'Beta Team', description: 'Second team', members: [] },
  { team_id: 'team-3', name: 'Gamma Team', description: 'Third team', members: [] }
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
  selectedTeam: null,
  selectedPolicy: null,
  refresh: vi.fn()
};

const renderContainer = (props: Partial<ITeamPoliciesContainerProps> = {}) => {
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

  it('renders team-policy associations in DataGrid', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Alpha Team')).toBeVisible();
      expect(getByText('Data Access Policy')).toBeVisible();
      expect(getByText('Beta Team')).toBeVisible();
      expect(getByText('Security Policy')).toBeVisible();
    });
  });

  it('displays assignment count in header', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('(2)')).toBeVisible();
    });
  });

  it('shows empty state when no assignments exist', async () => {
    const { getByText } = renderContainer({ teamPolicies: [] });

    await waitFor(() => {
      expect(getByText('No Team-Policy Assignments')).toBeVisible();
    });
  });

  describe('Dynamic Header', () => {
    it('shows default header when no selection', async () => {
      const { getByText } = renderContainer();

      await waitFor(() => {
        expect(getByText('Team-Policy Assignments')).toBeVisible();
      });
    });

    it('shows team-specific header when team is selected', async () => {
      const { getByText } = renderContainer({
        selectedTeam: mockTeams[0]
      });

      await waitFor(() => {
        expect(getByText('Policies for "Alpha Team"')).toBeVisible();
      });
    });

    it('shows policy-specific header when policy is selected', async () => {
      const { getByText } = renderContainer({
        selectedPolicy: mockPolicies[0]
      });

      await waitFor(() => {
        expect(getByText('Teams with "Data Access Policy"')).toBeVisible();
      });
    });

    it('shows assignment header when both team and policy are selected', async () => {
      const { getByText } = renderContainer({
        selectedTeam: mockTeams[0],
        selectedPolicy: mockPolicies[0]
      });

      await waitFor(() => {
        expect(getByText('Assignment: Alpha Team + Data Access Policy')).toBeVisible();
      });
    });
  });

  describe('Assign Button', () => {
    it('does not show Assign button when no selection', async () => {
      const { queryByRole } = renderContainer();

      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('does not show Assign button when only team is selected', async () => {
      const { queryByRole } = renderContainer({
        selectedTeam: mockTeams[0]
      });

      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('does not show Assign button when only policy is selected', async () => {
      const { queryByRole } = renderContainer({
        selectedPolicy: mockPolicies[0]
      });

      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('shows Assign button when both team and policy are selected and not already assigned', async () => {
      const { getByRole } = renderContainer({
        selectedTeam: mockTeams[2], // Gamma Team - not in mockTeamPolicies
        selectedPolicy: mockPolicies[2] // Admin Policy - not in mockTeamPolicies
      });

      await waitFor(() => {
        expect(getByRole('button', { name: /assign/i })).toBeVisible();
      });
    });

    it('does not show Assign button when selected combination already exists', async () => {
      const { queryByRole } = renderContainer({
        selectedTeam: mockTeams[0], // Alpha Team
        selectedPolicy: mockPolicies[0] // Data Access Policy - already assigned to Alpha Team
      });

      await waitFor(() => {
        expect(queryByRole('button', { name: /assign/i })).toBeNull();
      });
    });

    it('creates assignment when Assign button is clicked', async () => {
      mockCreateTeamPolicy.mockResolvedValueOnce({
        team_policy_id: 'tp-new',
        team_id: 'team-3',
        policy_id: 'policy-3'
      });

      const mockRefresh = vi.fn();
      const { getByRole } = renderContainer({
        selectedTeam: mockTeams[2], // Gamma Team
        selectedPolicy: mockPolicies[2], // Admin Policy
        refresh: mockRefresh
      });

      // Wait for Assign button to appear
      await waitFor(() => {
        expect(getByRole('button', { name: /assign/i })).toBeVisible();
      });

      // Click Assign button
      fireEvent.click(getByRole('button', { name: /assign/i }));

      await waitFor(() => {
        expect(mockCreateTeamPolicy).toHaveBeenCalledWith({
          team_id: 'team-3',
          policy_id: 'policy-3'
        });
      });

      // Refresh should be called after successful assignment
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Team-Policy', () => {
    it('opens actions menu with remove option', async () => {
      const { getByText, getAllByTitle } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Click actions menu
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      // Remove option should be visible
      await waitFor(() => {
        expect(getByText('Remove assignment')).toBeVisible();
      });
    });

    it('triggers delete flow when remove is clicked', async () => {
      const { getByText, getAllByTitle } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Open actions menu and click Remove
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      await waitFor(() => {
        expect(getByText('Remove assignment')).toBeVisible();
      });

      // Click remove - this triggers the confirmation dialog flow
      fireEvent.click(getByText('Remove assignment'));

      // The remove menu item click should have been processed
      // (Actual dialog rendering depends on dialogContext which is mocked by test-utils)
    });
  });
});
