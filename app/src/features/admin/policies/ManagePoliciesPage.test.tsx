import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { MemoryRouter } from 'react-router';
import { render } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { ManagePoliciesPage } from './ManagePoliciesPage';

interface MockPoliciesContainerProps {
  policies: IPolicy[];
}

interface MockTeamsContainerProps {
  teams: ITeam[];
}

interface MockTeamPoliciesContainerProps {
  teamPolicies: ITeamPolicyDetails[];
}

vi.mock('./components/PoliciesContainer', () => ({
  PoliciesContainer: ({ policies }: MockPoliciesContainerProps) => (
    <div data-testid="active-policies-list">
      {policies.map((p) => (
        <div key={p.policy_id} data-testid={`policy-${p.policy_id}`}>
          {p.name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('./components/TeamsContainer', () => ({
  TeamsContainer: ({ teams }: MockTeamsContainerProps) => (
    <div data-testid="teams-container">
      {teams.map((t) => (
        <div key={t.team_id} data-testid={`team-${t.team_id}`}>
          {t.name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('./components/TeamPoliciesContainer', () => ({
  TeamPoliciesContainer: ({ teamPolicies }: MockTeamPoliciesContainerProps) => (
    <div data-testid="team-policies-container">
      <div data-testid="header">Team-Policy Assignments</div>
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

const mockPolicies = [
  { policy_id: 'p1', name: 'Policy One', description: 'First policy', status: 'active', statements: [] },
  { policy_id: 'p2', name: 'Policy Two', description: 'Second policy', status: 'active', statements: [] }
];

const mockTeams = [
  { team_id: 't1', name: 'Team Alpha', description: 'First team', member_count: 0 },
  { team_id: 't2', name: 'Team Beta', description: 'Second team', member_count: 0 }
];

const mockTeamPolicies = [
  {
    team_policy_id: 'tp1',
    team_id: 't1',
    policy_id: 'p1',
    record_end_date: null,
    team_name: 'Team Alpha',
    policy_name: 'Policy One'
  },
  {
    team_policy_id: 'tp2',
    team_id: 't2',
    policy_id: 'p2',
    record_end_date: null,
    team_name: 'Team Beta',
    policy_name: 'Policy Two'
  },
  {
    team_policy_id: 'tp3',
    team_id: 't1',
    policy_id: 'p2',
    record_end_date: null,
    team_name: 'Team Alpha',
    policy_name: 'Policy Two'
  }
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

  describe('Assignments List', () => {
    it('shows all assignments when loaded', async () => {
      setupMocksWithData();
      const { getByTestId } = renderPage();

      await waitFor(() => {
        expect(getByTestId('tp-tp1')).toBeVisible();
        expect(getByTestId('tp-tp2')).toBeVisible();
        expect(getByTestId('tp-tp3')).toBeVisible();
      });
    });

    it('does not change assignments when clicking team or policy rows', async () => {
      setupMocksWithData();
      const { getByTestId } = renderPage();

      await waitFor(() => {
        expect(getByTestId('policy-p1')).toBeVisible();
        expect(getByTestId('team-t1')).toBeVisible();
      });

      fireEvent.click(getByTestId('policy-p1'));
      fireEvent.click(getByTestId('team-t1'));

      await waitFor(() => {
        expect(getByTestId('tp-tp1')).toBeVisible();
        expect(getByTestId('tp-tp2')).toBeVisible();
        expect(getByTestId('tp-tp3')).toBeVisible();
        expect(getByTestId('header')).toHaveTextContent('Team-Policy Assignments');
      });
    });
  });

  describe('API Integration', () => {
    it('calls getPolicies with correct pagination params on mount', async () => {
      setupMocksWithData();
      renderPage();

      await waitFor(() => {
        expect(mockGetPolicies).toHaveBeenCalledWith(
          { search: '' },
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
      setupMocksWithData();
      renderPage();

      await waitFor(() => {
        expect(mockGetTeams).toHaveBeenCalledWith(
          { search: '' },
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
      setupMocksWithData();
      renderPage();

      await waitFor(() => {
        expect(mockGetTeamPolicies).toHaveBeenCalledWith(
          { search: '' },
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
});
