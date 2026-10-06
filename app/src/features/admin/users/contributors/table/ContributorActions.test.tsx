import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { render, screen, fireEvent, waitFor } from 'test-helpers/test-utils';
import { ContributorActions } from './ContributorActions';

vi.mock('hooks/useApi');
vi.mock('hooks/useContext');
const remove = vi.fn();
const confirm = vi.fn();
const showError = vi.fn();
const handleChanged = vi.fn();
const contributor = {
  contributor_id: 1,
  client_id: 'SIMS',
  description: null,
  record_end_date: null
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useApi).mockReturnValue({ contributors: { deleteContributor: remove } } as unknown as ReturnType<
    typeof useApi
  >);
  vi.mocked(useDialogContext).mockReturnValue({
    setYesNoDialog: confirm,
    setErrorDialog: showError,
    setSnackbar: vi.fn()
  } as unknown as ReturnType<typeof useDialogContext>);
});

it('confirms the cascading soft-delete and refreshes only after success', async () => {
  remove.mockResolvedValue(undefined);
  render(<ContributorActions record={contributor} onChanged={handleChanged} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
  fireEvent.click(await screen.findByText('Delete'));
  expect(remove).not.toHaveBeenCalled();
  const options = confirm.mock.calls[0][0];
  expect(options.dialogContent).toContain('all its active user relationships');
  await options.onYes();
  await waitFor(() => expect(handleChanged).toHaveBeenCalledOnce());
  expect(remove).toHaveBeenCalledWith(1);
});

it('reports deletion failure without claiming that the data changed', async () => {
  remove.mockRejectedValue(new Error('Database unavailable'));
  render(<ContributorActions record={contributor} onChanged={handleChanged} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
  fireEvent.click(await screen.findByText('Delete'));
  await confirm.mock.calls[0][0].onYes();
  expect(showError).toHaveBeenCalledWith(expect.objectContaining({ dialogText: 'Database unavailable' }));
  expect(handleChanged).not.toHaveBeenCalled();
});
