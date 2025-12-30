import { fireEvent, within } from '@testing-library/react';
import { useApi } from 'hooks/useApi';
import { cleanup, render, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { TeamMemberSelect } from './TeamMemberSelect';

vi.mock('../../../../hooks/useApi');
const mockBiohubApi = useApi as Mock;

const mockUsers = [
  { system_user_id: 1, user_identifier: 'alice' },
  { system_user_id: 2, user_identifier: 'bob' },
  { system_user_id: 3, user_identifier: 'charlie' }
];

const mockGetAvailableUsers = vi.fn().mockResolvedValue({ users: mockUsers });

const mockUseApi = {
  teams: {
    getAvailableUsers: mockGetAvailableUsers
  }
};

describe('TeamMemberSelect', () => {
  beforeEach(() => {
    mockBiohubApi.mockImplementation(() => mockUseApi);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads available users on mount', async () => {
    const mockOnChange = vi.fn();

    render(<TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(mockGetAvailableUsers).toHaveBeenCalled();
    });
  });

  it('renders autocomplete input with correct label', async () => {
    const mockOnChange = vi.fn();

    const { getByLabelText } = render(<TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(getByLabelText('Team Members')).toBeVisible();
    });
  });

  it('renders with no selected users when selectedUserIds is empty', async () => {
    const mockOnChange = vi.fn();

    const { queryByRole } = render(<TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />);

    await waitFor(() => {
      // No chips should be rendered when no users are selected
      const chips = queryByRole('button', { name: /alice/i });
      expect(chips).toBeNull();
    });
  });

  it('displays selected users as chips when selectedUserIds and initialUsers are provided', async () => {
    const mockOnChange = vi.fn();
    const initialUsers = [
      { system_user_id: 1, user_identifier: 'alice' },
      { system_user_id: 2, user_identifier: 'bob' }
    ];

    const { getByText } = render(
      <TeamMemberSelect selectedUserIds={[1, 2]} onChange={mockOnChange} initialUsers={initialUsers} />
    );

    await waitFor(() => {
      expect(getByText('alice')).toBeVisible();
      expect(getByText('bob')).toBeVisible();
    });
  });

  it('displays user_identifier for selected users with initialUsers', async () => {
    const mockOnChange = vi.fn();
    const initialUsers = [{ system_user_id: 3, user_identifier: 'charlie' }];

    const { getByText } = render(
      <TeamMemberSelect selectedUserIds={[3]} onChange={mockOnChange} initialUsers={initialUsers} />
    );

    await waitFor(() => {
      expect(getByText('charlie')).toBeVisible();
    });
  });

  it('calls onChange with user IDs when selection changes', async () => {
    const mockOnChange = vi.fn();

    const { getByLabelText, getByRole } = render(<TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />);

    // Wait for users to load
    await waitFor(() => {
      expect(mockGetAvailableUsers).toHaveBeenCalled();
    });

    // Open the dropdown
    const input = getByLabelText('Team Members');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Wait for listbox to appear and select first option
    await waitFor(() => {
      const listbox = getByRole('listbox');
      expect(listbox).toBeVisible();
    });

    const listbox = getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    fireEvent.click(options[0]);

    // Verify onChange was called with the selected user ID
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([1]);
    });
  });

  it('displays user_identifier in dropdown options', async () => {
    const mockOnChange = vi.fn();

    const { getByLabelText, getByRole, getByText } = render(
      <TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />
    );

    // Wait for users to load
    await waitFor(() => {
      expect(mockGetAvailableUsers).toHaveBeenCalled();
    });

    // Open the dropdown
    const input = getByLabelText('Team Members');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Wait for listbox to appear
    await waitFor(() => {
      const listbox = getByRole('listbox');
      expect(listbox).toBeVisible();
    });

    // Verify user_identifier is displayed
    expect(getByText('alice')).toBeVisible();
    expect(getByText('bob')).toBeVisible();
  });

  it('removes user when chip is deleted', async () => {
    const mockOnChange = vi.fn();
    const initialUsers = [
      { system_user_id: 1, user_identifier: 'alice' },
      { system_user_id: 2, user_identifier: 'bob' }
    ];

    const { getAllByTestId, getByText } = render(
      <TeamMemberSelect selectedUserIds={[1, 2]} onChange={mockOnChange} initialUsers={initialUsers} />
    );

    // Wait for chips to render
    await waitFor(() => {
      expect(getByText('alice')).toBeVisible();
      expect(getByText('bob')).toBeVisible();
    });

    // Find and click the delete button on first chip (Alice)
    const cancelIcons = getAllByTestId('CancelIcon');
    fireEvent.click(cancelIcons[0]);

    // Verify onChange was called without the removed user
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([2]);
    });
  });

  it('passes search parameter to API when typing', async () => {
    const mockOnChange = vi.fn();

    const { getByLabelText } = render(<TeamMemberSelect selectedUserIds={[]} onChange={mockOnChange} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetAvailableUsers).toHaveBeenCalledWith(undefined);
    });

    // Clear initial call count
    mockGetAvailableUsers.mockClear();

    // Type in the search input
    const input = getByLabelText('Team Members');
    fireEvent.change(input, { target: { value: 'ali' } });

    // Wait for debounced search to trigger (300ms debounce)
    await waitFor(
      () => {
        expect(mockGetAvailableUsers).toHaveBeenCalledWith('ali');
      },
      { timeout: 500 }
    );
  });

  it('keeps selected users visible even when search results change', async () => {
    // Start with all users in search results
    mockGetAvailableUsers.mockResolvedValueOnce({ users: mockUsers });

    const mockOnChange = vi.fn();
    const initialUsers = [{ system_user_id: 1, user_identifier: 'alice' }];

    const { getAllByText, getByLabelText, queryByRole } = render(
      <TeamMemberSelect selectedUserIds={[1]} onChange={mockOnChange} initialUsers={initialUsers} />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetAvailableUsers).toHaveBeenCalled();
    });

    // Alice should be visible as selected chip
    const aliceChip = queryByRole('button', { name: /alice/i });
    expect(aliceChip).toBeInTheDocument();

    // Mock a search that returns different users (not including alice)
    mockGetAvailableUsers.mockResolvedValueOnce({
      users: [{ system_user_id: 4, user_identifier: 'david' }]
    });

    // Type a search that wouldn't normally include alice
    const input = getByLabelText('Team Members');
    fireEvent.change(input, { target: { value: 'dav' } });

    // Wait for search to complete
    await waitFor(
      () => {
        expect(mockGetAvailableUsers).toHaveBeenCalledWith('dav');
      },
      { timeout: 500 }
    );

    // Alice should still be visible as a chip because she's selected (cached)
    // Use getAllByText since alice may appear as chip and in dropdown
    const aliceElements = getAllByText('alice');
    expect(aliceElements.length).toBeGreaterThan(0);
  });
});
