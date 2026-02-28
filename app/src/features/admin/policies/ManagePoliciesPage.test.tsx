import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ManagePoliciesPage } from './ManagePoliciesPage';

// Types for mock component props
interface MockPoliciesContainerProps {
  policies: IPolicy[];
  onSelectPolicy: (id: string | null) => void;
  selectedPolicyId: string | null;
}

interface MockTeamsContainerProps {
  teams: ITeam[];
  onSelectTeam: (id: string | null) => void;
  selectedTeamId: string | null;
}

interface MockTeamPoliciesContainerProps {
  teamPolicies: ITeamPolicyDetails[];
  selectedTeam: ITeam | null;
  selectedPolicy: IPolicy | null;
}

// Mock child components - we test them separately, here we test page logic
vi.mock('./components/PoliciesContainer', () => ({
  PoliciesContainer: ({ policies, onSelectPolicy, selectedPolicyId }: MockPoliciesContainerProps) => (
    <div data-testid="active-policies-list">
      {policies.map((p) => (
        <div
          key={p.policy_id}
          data-testid={`policy-${p.policy_id}`}
          data-selected={selectedPolicyId === p.policy_id}
          onClick={() => onSelectPolicy(selectedPolicyId === p.policy_id ? null : p.policy_id)}>
          {p.name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('./components/TeamsContainer', () => ({
  TeamsContainer: ({ teams, onSelectTeam, selectedTeamId }: MockTeamsContainerProps) => (
    <div data-testid="teams-container">
      {teams.map((t) => (
        <div
          key={t.team_id}
          data-testid={`team-${t.team_id}`}
          data-selected={selectedTeamId === t.team_id}
          onClick={() => onSelectTeam(selectedTeamId === t.team_id ? null : t.team_id)}>
          {t.name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('./components/TeamPoliciesContainer', () => ({
  TeamPoliciesContainer: ({ teamPolicies, selectedTeam, selectedPolicy }: MockTeamPoliciesContainerProps) => (
    <div data-testid="team-policies-container">
      <div data-testid="header">
        {selectedTeam && selectedPolicy
          ? `Assignment: ${selectedTeam.name} + ${selectedPolicy.name}`
          : selectedTeam
            ? `Policies for "${selectedTeam.name}"`
            : selectedPolicy
              ? `Teams with "${selectedPolicy.name}"`
              : 'Team-Policy Assignments'}
      </div>
      {teamPolicies.map((tp) => (
        <div key={tp.team_policy_id} data-testid={`tp-${tp.team_policy_id}`}>
          {tp.team_name} - {tp.policy_name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

// Mock data
const mockPolicies = [
  { policy_id: 'p1', name: 'Policy One', description: 'First policy', statements: [] },
  { policy_id: 'p2', name: 'Policy Two', description: 'Second policy', statements: [] }
];

const mockTeams = [
  { team_id: 't1', name: 'Team Alpha', description: 'First team', member_count: 0 },
  { team_id: 't2', name: 'Team Beta', description: 'Second team', member_count: 0 }
];

const mockTeamPolicies = [
  { team_policy_id: 'tp1', team_id: 't1', policy_id: 'p1', team_name: 'Team Alpha', policy_name: 'Policy One' },
  { team_policy_id: 'tp2', team_id: 't2', policy_id: 'p2', team_name: 'Team Beta', policy_name: 'Policy Two' },
  { team_policy_id: 'tp3', team_id: 't1', policy_id: 'p2', team_name: 'Team Alpha', policy_name: 'Policy Two' }
];

const mockGetPolicies = vi.fn();
const mockGetTeams = vi.fn();
const mockGetTeamPolicies = vi.fn();

const mockUseApi = {
  policies: {
    getPolicies: mockGetPolicies
  },
  teams: {
    getTeams: mockGetTeams
  },
  teamPolicies: {
    getTeamPolicies: mockGetTeamPolicies
  }
};

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ManagePoliciesPage />
    </MemoryRouter>
  );
};

const setupMocksWithData = () => {
  mockGetPolicies.mockResolvedValue({
    policies: mockPolicies,
    pagination: { total: 2, page: 1, limit: 10 }
  });
  mockGetTeams.mockResolvedValue({
    teams: mockTeams,
    pagination: { total: 2, page: 1, limit: 10 }
  });
  mockGetTeamPolicies.mockResolvedValue({
    team_policies: mockTeamPolicies,
    pagination: { total: 3, page: 1, limit: 10 }
  });
};

describe('ManagePoliciesPage', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Client-Side Filtering (Team-Policy Assignments)', () => {
    it('shows all assignments when nothing selected', async () => {
      // Step 1: Setup API mocks to return test data
      setupMocksWithData();

      // Step 2: Render page
      const { getByTestId } = renderPage();

      // Step 3: Verify all 3 assignments are visible (no filtering)
      await waitFor(() => {
        expect(getByTestId('tp-tp1')).toBeVisible();
        expect(getByTestId('tp-tp2')).toBeVisible();
        expect(getByTestId('tp-tp3')).toBeVisible();
      });
    });

    it('filters assignments when policy is selected', async () => {
      // Step 1: Setup API mocks
      setupMocksWithData();

      // Step 2: Render page
      const { getByTestId, queryByTestId } = renderPage();

      // Step 3: Wait for policies to load
      await waitFor(() => {
        expect(getByTestId('policy-p1')).toBeVisible();
      });

      // Step 4: Click on Policy One (p1) to select it
      fireEvent.click(getByTestId('policy-p1'));

      // Step 5: Verify filtering - only tp1 has policy_id='p1'
      await waitFor(() => {
        expect(getByTestId('tp-tp1')).toBeVisible();
        expect(queryByTestId('tp-tp2')).toBeNull();
        expect(queryByTestId('tp-tp3')).toBeNull();
      });
    });

    it('filters assignments when team is selected', async () => {
      // Step 1: Setup API mocks
      setupMocksWithData();

      // Step 2: Render page
      const { getByTestId, queryByTestId } = renderPage();

      // Step 3: Wait for teams to load
      await waitFor(() => {
        expect(getByTestId('team-t1')).toBeVisible();
      });

      // Step 4: Click on Team Alpha (t1) to select it
      fireEvent.click(getByTestId('team-t1'));

      // Step 5: Verify filtering - tp1 and tp3 have team_id='t1'
      await waitFor(() => {
        expect(getByTestId('tp-tp1')).toBeVisible();
        expect(queryByTestId('tp-tp2')).toBeNull();
        expect(getByTestId('tp-tp3')).toBeVisible();
      });
    });

    it('filters assignments when both team and policy selected', async () => {
      // Step 1: Setup API mocks
      setupMocksWithData();

      // Step 2: Render page
      const { getByTestId, queryByTestId } = renderPage();

      // Step 3: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('policy-p2')).toBeVisible();
        expect(getByTestId('team-t1')).toBeVisible();
      });

      // Step 4: Select Policy Two AND Team Alpha
      fireEvent.click(getByTestId('policy-p2'));
      fireEvent.click(getByTestId('team-t1'));

      // Step 5: Verify intersection - only tp3 has both team_id='t1' AND policy_id='p2'
      await waitFor(() => {
        expect(queryByTestId('tp-tp1')).toBeNull();
        expect(queryByTestId('tp-tp2')).toBeNull();
        expect(getByTestId('tp-tp3')).toBeVisible();
      });
    });
  });

  describe('Dynamic Header Updates', () => {
    it('updates header when team selected', async () => {
      // Step 1: Setup and render
      setupMocksWithData();
      const { getByTestId } = renderPage();

      // Step 2: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('team-t1')).toBeVisible();
      });

      // Step 3: Select a team
      fireEvent.click(getByTestId('team-t1'));

      // Step 4: Verify header shows team-specific text
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Policies for "Team Alpha"');
      });
    });

    it('updates header when policy selected', async () => {
      // Step 1: Setup and render
      setupMocksWithData();
      const { getByTestId } = renderPage();

      // Step 2: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('policy-p1')).toBeVisible();
      });

      // Step 3: Select a policy
      fireEvent.click(getByTestId('policy-p1'));

      // Step 4: Verify header shows policy-specific text
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Teams with "Policy One"');
      });
    });

    it('updates header when both selected', async () => {
      // Step 1: Setup and render
      setupMocksWithData();
      const { getByTestId } = renderPage();

      // Step 2: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('team-t1')).toBeVisible();
        expect(getByTestId('policy-p1')).toBeVisible();
      });

      // Step 3: Select both team and policy
      fireEvent.click(getByTestId('team-t1'));
      fireEvent.click(getByTestId('policy-p1'));

      // Step 4: Verify header shows combined assignment text
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Assignment: Team Alpha + Policy One');
      });
    });
  });

  describe('API Integration', () => {
    it('calls getPolicies with correct pagination params on mount', async () => {
      // Step 1: Setup mocks
      setupMocksWithData();

      // Step 2: Render page (triggers API calls)
      renderPage();

      // Step 3: Verify getPolicies was called with correct params
      await waitFor(() => {
        expect(mockGetPolicies).toHaveBeenCalledWith(
          { search: undefined },
          expect.objectContaining({
            page: 1,
            limit: 10,
            sort: 'name',
            order: 'asc'
          })
        );
      });
    });

    it('calls getTeams with correct pagination params on mount', async () => {
      // Step 1: Setup mocks
      setupMocksWithData();

      // Step 2: Render page (triggers API calls)
      renderPage();

      // Step 3: Verify getTeams was called with correct params
      await waitFor(() => {
        expect(mockGetTeams).toHaveBeenCalledWith(
          { search: undefined },
          expect.objectContaining({
            page: 1,
            limit: 10,
            sort: 'name',
            order: 'asc'
          })
        );
      });
    });

    it('calls getTeamPolicies with correct pagination params on mount', async () => {
      // Step 1: Setup mocks
      setupMocksWithData();

      // Step 2: Render page (triggers API calls)
      renderPage();

      // Step 3: Verify getTeamPolicies was called with correct params
      await waitFor(() => {
        expect(mockGetTeamPolicies).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            limit: 10,
            sort: 'team_name',
            order: 'asc'
          })
        );
      });
    });
  });

  describe('Selection State', () => {
    it('deselects policy when clicking selected policy', async () => {
      // Step 1: Setup and render
      setupMocksWithData();
      const { getByTestId } = renderPage();

      // Step 2: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('policy-p1')).toBeVisible();
      });

      // Step 3: Click to SELECT policy
      fireEvent.click(getByTestId('policy-p1'));
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Teams with "Policy One"');
      });

      // Step 4: Click again to DESELECT (toggle behavior)
      fireEvent.click(getByTestId('policy-p1'));

      // Step 5: Verify header returns to default state
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Team-Policy Assignments');
      });
    });

    it('deselects team when clicking selected team', async () => {
      // Step 1: Setup and render
      setupMocksWithData();
      const { getByTestId } = renderPage();

      // Step 2: Wait for data to load
      await waitFor(() => {
        expect(getByTestId('team-t1')).toBeVisible();
      });

      // Step 3: Click to SELECT team
      fireEvent.click(getByTestId('team-t1'));
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Policies for "Team Alpha"');
      });

      // Step 4: Click again to DESELECT (toggle behavior)
      fireEvent.click(getByTestId('team-t1'));

      // Step 5: Verify header returns to default state
      await waitFor(() => {
        expect(getByTestId('header')).toHaveTextContent('Team-Policy Assignments');
      });
    });
  });
});
