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

  it('displays selected users as chips when selectedUserIds are provided', async () => {
    const mockOnChange = vi.fn();

    const { getByText } = render(<TeamMemberSelect selectedUserIds={[1, 2]} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(getByText('alice')).toBeVisible();
      expect(getByText('bob')).toBeVisible();
    });
  });

  it('displays user_identifier for all users', async () => {
    const mockOnChange = vi.fn();

    const { getByText } = render(<TeamMemberSelect selectedUserIds={[3]} onChange={mockOnChange} />);

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

    const { getAllByTestId, getByText } = render(<TeamMemberSelect selectedUserIds={[1, 2]} onChange={mockOnChange} />);

    // Wait for chips to render (users must be loaded first)
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
});
