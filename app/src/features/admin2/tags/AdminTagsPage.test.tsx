import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ITag } from 'interfaces/useTagsApi.interface';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { AdminTagsPage } from './AdminTagsPage';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('hooks/useContext', () => ({ useDialogContext: vi.fn() }));

const tag: ITag = {
  tag_id: '11111111-1111-4111-8111-111111111111',
  name: 'Urgent',
  description: 'Needs attention today',
  color: '#D8292F',
  create_date: '2026-10-01T00:00:00.000Z'
};

describe('AdminTagsPage', () => {
  const getTags = vi.fn();
  const createTag = vi.fn();
  const deleteTag = vi.fn();
  const setYesNoDialog = vi.fn();
  const setSnackbar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTags.mockResolvedValue({ tags: [tag] });
    (useApi as Mock).mockReturnValue({ tags: { getTags, createTag, deleteTag } });
    (useDialogContext as Mock).mockReturnValue({ setYesNoDialog, setSnackbar });
  });

  /**
   * Renders the tags page.
   *
   * @returns The RTL render result.
   */
  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminTagsPage />
      </MemoryRouter>
    );

  it('lists each tag with its description', async () => {
    renderPage();

    expect(await screen.findByText('Urgent')).toBeVisible();
    expect(screen.getByText('Needs attention today')).toBeVisible();
  });

  it('warns that deleting a tag removes it from every ticket and board, and deletes it once confirmed', async () => {
    deleteTag.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Urgent');

    fireEvent.click(screen.getByTestId('custom-menu-icon-Actions'));
    fireEvent.click(await screen.findByTestId('custom-menu-icon-item-Deletetag'));

    const confirmation = setYesNoDialog.mock.lastCall![0];
    render(confirmation.dialogContent);
    expect(screen.getByText(/removes it from all tickets, boards and swimlanes/)).toBeVisible();
    expect(deleteTag).not.toHaveBeenCalled();

    act(() => confirmation.onYes());

    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith(tag.tag_id));
  });

  it('keeps the create dialog open with the server error when the name is taken', async () => {
    createTag.mockRejectedValue(new Error('A tag with this name already exists'));
    renderPage();
    await screen.findByText('Urgent');

    fireEvent.click(screen.getByTestId('tags-add-button'));
    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: 'urgent' } });
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    expect(await screen.findByText('A tag with this name already exists')).toBeVisible();
    expect(createTag).toHaveBeenCalledWith({ name: 'urgent', description: null, color: '#1A5A96' });
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
