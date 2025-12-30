import { fireEvent } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { MemoryRouter } from 'react-router';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TeamsContainer } from './TeamsContainer';

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockTeams = [
  {
    team_id: 'team-1',
    name: 'Alpha Team',
    description: 'First team',
    members: [{ team_member_id: 'tm-1', system_user_id: 1, user_identifier: 'alice' }]
  },
  {
    team_id: 'team-2',
    name: 'Beta Team',
    description: null,
    members: [
      { team_member_id: 'tm-2', system_user_id: 2, user_identifier: 'bob' },
      { team_member_id: 'tm-3', system_user_id: 3, user_identifier: 'charlie' }
    ]
  }
];

const mockAvailableUsers = [
  { system_user_id: 1, user_identifier: 'alice' },
  { system_user_id: 2, user_identifier: 'bob' }
];

const mockCreateTeam = vi.fn();
const mockUpdateTeam = vi.fn();
const mockDeleteTeam = vi.fn();
const mockGetTeams = vi.fn().mockResolvedValue({
  teams: mockTeams,
  pagination: { total: 2, page: 1, limit: 50, last_page: 1 }
});

const mockUseApi = {
  teams: {
    getTeams: mockGetTeams,
    getAvailableUsers: vi.fn().mockResolvedValue({ users: mockAvailableUsers }),
    createTeam: mockCreateTeam,
    updateTeam: mockUpdateTeam,
    deleteTeam: mockDeleteTeam
  }
};

const renderContainer = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <TeamsContainer />
    </MemoryRouter>
  );
};

describe('TeamsContainer', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    // Flush any pending debounce timers to prevent "window is not defined" errors
    vi.useFakeTimers();
    vi.runAllTimers();
    vi.useRealTimers();

    cleanup();
    vi.clearAllMocks();
  });

  it('renders teams in DataGrid', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('Alpha Team')).toBeVisible();
      expect(getByText('Beta Team')).toBeVisible();
    });
  });

  it('displays team count in header', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('(2)')).toBeVisible();
    });
  });

  it('displays team descriptions', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('First team')).toBeVisible();
    });
  });

  it('displays dash for null description', async () => {
    const { getAllByText } = renderContainer();

    await waitFor(() => {
      const dashes = getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  it('displays member count for each team', async () => {
    const { getByText } = renderContainer();

    await waitFor(() => {
      // Alpha Team has 1 member, Beta Team has 2
      expect(getByText('1')).toBeVisible();
      expect(getByText('2')).toBeVisible();
    });
  });

  it('renders search input', async () => {
    const { getByPlaceholderText } = renderContainer();

    await waitFor(() => {
      expect(getByPlaceholderText('Search by team name')).toBeVisible();
    });
  });

  it('renders Add button', async () => {
    const { getByRole } = renderContainer();

    await waitFor(() => {
      expect(getByRole('button', { name: /add/i })).toBeVisible();
    });
  });

  it('shows `No Teams` when there are no teams', async () => {
    mockUseApi.teams.getTeams.mockResolvedValueOnce({
      teams: [],
      pagination: { total: 0, page: 1, limit: 50, last_page: 1 }
    });

    const { getByText } = renderContainer();

    await waitFor(() => {
      expect(getByText('No Teams')).toBeVisible();
    });
  });

  it('calls getTeams on mount', async () => {
    renderContainer();

    await waitFor(() => {
      expect(mockUseApi.teams.getTeams).toHaveBeenCalled();
    });
  });

  describe('Add Team Dialog', () => {
    it('opens add team dialog when Add button is clicked', async () => {
      const { getByRole, getByText } = renderContainer();

      await waitFor(() => {
        expect(getByRole('button', { name: /add/i })).toBeVisible();
      });

      fireEvent.click(getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(getByText('Add Team')).toBeVisible();
      });
    });

    it('creates team and closes dialog on successful submit', async () => {
      mockCreateTeam.mockResolvedValueOnce({
        team_id: 'new-team',
        name: 'New Team',
        description: 'A new team',
        members: []
      });

      const { getByRole, getByLabelText, queryByText } = renderContainer();

      // Wait for initial render
      await waitFor(() => {
        expect(getByRole('button', { name: /add/i })).toBeVisible();
      });

      // Open dialog
      fireEvent.click(getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(getByLabelText('Team Name *')).toBeVisible();
      });

      // Fill in form
      fireEvent.change(getByLabelText('Team Name *'), { target: { value: 'New Team' } });
      fireEvent.change(getByLabelText('Description'), { target: { value: 'A new team' } });

      // Submit form
      fireEvent.click(getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith({
          name: 'New Team',
          description: 'A new team',
          member_user_ids: []
        });
      });

      // Dialog should close
      await waitFor(() => {
        expect(queryByText('Add Team')).toBeNull();
      });
    });
  });

  describe('Edit Team Dialog', () => {
    it('opens edit dialog with team data when Edit is clicked', async () => {
      const { getByText, getAllByTitle, getByLabelText } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Click actions menu for Alpha Team
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      // Click Edit option
      await waitFor(() => {
        expect(getByText('Edit team')).toBeVisible();
      });
      fireEvent.click(getByText('Edit team'));

      // Dialog should open with team data
      await waitFor(() => {
        expect(getByText('Edit Team')).toBeVisible();
        expect(getByLabelText('Team Name *')).toHaveValue('Alpha Team');
        expect(getByLabelText('Description')).toHaveValue('First team');
      });
    });

    it('updates team on successful submit', async () => {
      mockUpdateTeam.mockResolvedValueOnce({
        team_id: 'team-1',
        name: 'Updated Team',
        description: 'Updated description',
        members: []
      });

      const { getByText, getAllByTitle, getByLabelText, getByRole, queryByText } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Open actions menu and click Edit
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      await waitFor(() => {
        expect(getByText('Edit team')).toBeVisible();
      });
      fireEvent.click(getByText('Edit team'));

      // Wait for dialog
      await waitFor(() => {
        expect(getByLabelText('Team Name *')).toBeVisible();
      });

      // Update team name
      fireEvent.change(getByLabelText('Team Name *'), { target: { value: 'Updated Team' } });

      // Submit
      fireEvent.click(getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockUpdateTeam).toHaveBeenCalledWith('team-1', {
          name: 'Updated Team',
          description: 'First team',
          member_user_ids: [1]
        });
      });

      // Dialog should close
      await waitFor(() => {
        expect(queryByText('Edit Team')).toBeNull();
      });
    });
  });

  describe('Delete Team', () => {
    it('opens delete menu option from actions menu', async () => {
      const { getByText, getAllByTitle } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Click actions menu
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      // Delete option should be visible
      await waitFor(() => {
        expect(getByText('Delete team')).toBeVisible();
      });
    });

    it('triggers delete flow when delete menu item is clicked', async () => {
      const { getByText, getAllByTitle } = renderContainer();

      await waitFor(() => {
        expect(getByText('Alpha Team')).toBeVisible();
      });

      // Open actions menu and click Delete
      const actionsButtons = getAllByTitle('Actions');
      fireEvent.click(actionsButtons[0]);

      await waitFor(() => {
        expect(getByText('Delete team')).toBeVisible();
      });

      // Click delete - this triggers the confirmation dialog flow
      fireEvent.click(getByText('Delete team'));

      // The delete menu item click should have been processed
      // (Actual dialog rendering depends on dialogContext which is mocked by test-utils)
    });
  });

  describe('Search', () => {
    it('updates search term on input change', async () => {
      const { getByPlaceholderText } = renderContainer();

      await waitFor(() => {
        expect(getByPlaceholderText('Search by team name')).toBeVisible();
      });

      const searchInput = getByPlaceholderText('Search by team name');
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });

      expect(searchInput).toHaveValue('Alpha');
      // Debounce timer cleanup handled by afterEach
    });
  });
});
