import { useApi } from 'hooks/useApi';
import { render, screen, fireEvent, waitFor } from 'test-helpers/test-utils';
import { ContributorUserDialog } from './ContributorUserDialog';

vi.mock('hooks/useApi');
const create = vi.fn();
const listUsers = vi.fn();
const handleSaved = vi.fn();
const handleClose = vi.fn();
const contributor = {
  contributor_id: 2,
  client_id: 'Other client',
  description: null,
  record_end_date: null
};
const user = { system_user_id: 4, user_identifier: 'service-account', display_name: null, record_end_date: null };

beforeEach(() => {
  vi.clearAllMocks();
  listUsers.mockResolvedValue({
    users: [user, { ...user, system_user_id: 5, user_identifier: 'blocked', record_end_date: '2026-01-01' }],
    pagination: { last_page: 2 }
  });
  vi.mocked(useApi).mockReturnValue({
    contributors: {
      listSystemUserOptions: listUsers,
      createContributorUser: create
    }
  } as unknown as ReturnType<typeof useApi>);
});

it('requires a user selection before creating a relationship', async () => {
  render(<ContributorUserDialog contributor={contributor} onClose={handleClose} onSaved={handleSaved} />);
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  expect(await screen.findByText('Select a system user')).toBeVisible();
  expect(create).not.toHaveBeenCalled();
});

it('creates an assignment and disables blocked users', async () => {
  create.mockResolvedValue({});
  render(<ContributorUserDialog contributor={contributor} onClose={handleClose} onSaved={handleSaved} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Search users to add/ }));
  expect(await screen.findByRole('option', { name: 'blocked' })).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(screen.getByRole('option', { name: 'service-account' }));
  expect(screen.getByRole('button', { name: 'Remove service-account' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: /Search users to add/ })).toHaveValue('');
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  await waitFor(() => expect(create).toHaveBeenCalledWith({ contributorId: 2, systemUserId: 4 }));
  expect(handleSaved).toHaveBeenCalledOnce();
});

it('fetches only ten matches per search without pagination controls', async () => {
  render(<ContributorUserDialog contributor={contributor} onClose={handleClose} onSaved={handleSaved} />);
  await waitFor(() => expect(listUsers).toHaveBeenCalledWith('', { page: 1, limit: 10 }));
  expect(screen.queryByRole('button', { name: 'Next system users' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Previous system users' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: /Search users to add/ }), { target: { value: 'service' } });
  await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith('service', { page: 1, limit: 10 }));
});

it('retains the selected user after a failed save and allows removing the card', async () => {
  create.mockRejectedValue(new Error('Unable to add user'));
  render(<ContributorUserDialog contributor={contributor} onClose={handleClose} onSaved={handleSaved} />);
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Search users to add/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'service-account' }));
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  expect(await screen.findByText('Unable to add user')).toBeVisible();
  expect(handleClose).not.toHaveBeenCalled();
  expect(handleSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove service-account' }));
  expect(screen.queryByRole('button', { name: 'Remove service-account' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  expect(await screen.findByText('Select a system user')).toBeVisible();
  expect(create).toHaveBeenCalledTimes(1);
});
