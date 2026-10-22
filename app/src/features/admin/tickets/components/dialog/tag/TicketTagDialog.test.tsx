import { useApi } from 'hooks/useApi';
import { ITagSummary, ITicketTag } from 'interfaces/useTagsApi.interface';
import { fireEvent, render, screen, waitFor, within } from 'test-helpers/test-utils';
import { Mock } from 'vitest';
import { useTicketTagsQuery } from '../../../hooks/useTicketTagsQuery';
import { useUpdateTicketTagsMutation } from '../../../hooks/useUpdateTicketTagsMutation';
import { TicketTagDialog } from './TicketTagDialog';

vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));
vi.mock('../../../hooks/useTicketTagsQuery', () => ({ useTicketTagsQuery: vi.fn() }));
vi.mock('../../../hooks/useUpdateTicketTagsMutation', () => ({ useUpdateTicketTagsMutation: vi.fn() }));

const triageTag: ITicketTag = {
  tag_id: 'tag-1',
  name: 'Triage',
  color: '#FCBA19',
  tag_rule_id: null,
  tag_rule_name: null
};
const urgentTag: ITicketTag = { ...triageTag, tag_id: 'tag-4', name: 'Urgent', color: '#D8292F' };
const fishTag: ITagSummary = { tag_id: 'tag-2', name: 'Fish', color: '#1E90FF' };
const ticketTagsData = { tags: [triageTag, urgentTag], events: [] };

describe('TicketTagDialog', () => {
  const mutate = vi.fn();
  const getTags = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getTags.mockResolvedValue({
      tags: [triageTag, urgentTag, fishTag],
      pagination: { total: 3, current_page: 1, last_page: 1, per_page: 50 }
    });
    (useApi as Mock).mockReturnValue({ tags: { getTags } });
    (useTicketTagsQuery as Mock).mockReturnValue({ data: ticketTagsData });
    (useUpdateTicketTagsMutation as Mock).mockReturnValue({ mutate, isPending: false });
  });

  it("lists the ticket's tags as cards, and saves the set with tags added and removed", async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_tags, options) => options.onSuccess());
    render(<TicketTagDialog open onClose={onClose} />);

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Triage')).toBeVisible();
    expect(dialog.getByText('Urgent')).toBeVisible();

    fireEvent.mouseDown(dialog.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'Fish' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Triage' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Fish' }));
    fireEvent.click(dialog.getByRole('button', { name: 'remove Urgent' }));
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mutate).toHaveBeenCalledWith([triageTag, fishTag], { onSuccess: onClose }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('saves an empty set when every tag is removed', async () => {
    render(<TicketTagDialog open onClose={vi.fn()} />);
    const dialog = within(await screen.findByRole('dialog'));

    fireEvent.click(dialog.getByRole('button', { name: 'remove Triage' }));
    fireEvent.click(dialog.getByRole('button', { name: 'remove Urgent' }));
    fireEvent.click(screen.getByTestId('edit-dialog-save-button'));

    await waitFor(() => expect(mutate).toHaveBeenCalledWith([], expect.anything()));
  });
});
