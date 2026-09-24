import { useApi } from 'hooks/useApi';
import { fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { ContributorDialog } from './ContributorDialog';

vi.mock('hooks/useApi');
const create = vi.fn();
const update = vi.fn();
const handleSaved = vi.fn();
const handleClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApi).mockReturnValue({
    contributors: { createContributor: create, updateContributor: update }
  } as unknown as ReturnType<typeof useApi>);
});

it('validates client ID before sending a request', async () => {
  render(<ContributorDialog onClose={handleClose} onSaved={handleSaved} />);
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  expect(await screen.findByText('Client ID is required')).toBeVisible();
  expect(create).not.toHaveBeenCalled();
});

it('retains input on failure and closes only after a successful retry', async () => {
  create.mockRejectedValueOnce(new Error('Client ID already exists')).mockResolvedValueOnce({});
  render(<ContributorDialog onClose={handleClose} onSaved={handleSaved} />);
  fireEvent.change(screen.getByLabelText(/Client ID/), { target: { value: ' SIMS ' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test contributor' } });
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  expect(await screen.findByText('Client ID already exists')).toBeVisible();
  expect(screen.getByLabelText(/Client ID/)).toHaveValue(' SIMS ');
  expect(handleClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  await waitFor(() => expect(handleSaved).toHaveBeenCalledOnce());
  expect(create).toHaveBeenLastCalledWith({ clientId: 'SIMS', description: 'Test contributor' });
  expect(handleClose).toHaveBeenCalledOnce();
});

it('edits an existing contributor and disables submission while saving', async () => {
  let finish: (value: unknown) => void = () => undefined;
  update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  render(
    <ContributorDialog
      record={{
        contributor_id: 4,
        client_id: 'SIMS',
        description: null,
        record_end_date: null
      }}
      onClose={handleClose}
      onSaved={handleSaved}
    />
  );
  fireEvent.click(screen.getByTestId('edit-dialog-save-button'));
  await waitFor(() => expect(screen.getByTestId('edit-dialog-save-button')).toBeDisabled());
  expect(update).toHaveBeenCalledWith(4, { clientId: 'SIMS', description: null });
  finish({});
  await waitFor(() => expect(handleSaved).toHaveBeenCalledOnce());
});
