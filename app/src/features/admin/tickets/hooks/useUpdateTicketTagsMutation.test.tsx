import { ITicketTag, ITicketTagsResponse } from 'interfaces/useTagsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { useUpdateTicketTagsMutation } from './useUpdateTicketTagsMutation';

const mocks = vi.hoisted(() => ({ updateTicketTags: vi.fn(), setSnackbar: vi.fn() }));
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tags: { updateTicketTags: mocks.updateTicketTags } })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useTicketContext: () => ({ ticketId: 'ticket-1' })
}));

const tagsQueryKey = ticketQueryKeys.tags('ticket-1');
const urgent: ITicketTag = {
  tag_id: 'tag-1',
  name: 'Urgent',
  color: '#D8292F',
  tag_rule_id: null,
  tag_rule_name: null
};
const blocked: ITicketTag = {
  tag_id: 'tag-2',
  name: 'Blocked',
  color: '#FCBA19',
  tag_rule_id: null,
  tag_rule_name: null
};
const initial: ITicketTagsResponse = { tags: [urgent], events: [] };

describe('useUpdateTicketTagsMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the new tags before saving the complete set, then keeps the saved tags and history', async () => {
    const saved: ITicketTagsResponse = {
      tags: [urgent, blocked],
      events: [
        {
          ticket_tag_id: 'ticket-tag-2',
          tag_id: 'tag-2',
          tag_name: 'Blocked',
          tag_color: '#FCBA19',
          action: 'added',
          user_identifier: 'sarah',
          tag_rule_name: null,
          event_date: '2026-10-01T00:00:00.000Z'
        }
      ]
    };
    let finishSave!: (response: ITicketTagsResponse) => void;
    mocks.updateTicketTags.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(tagsQueryKey, initial);
    const { result } = renderHook(() => useUpdateTicketTagsMutation(), { queryClient });

    act(() => result.current.mutate([urgent, blocked]));

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketTagsResponse>(tagsQueryKey)?.tags).toEqual([urgent, blocked])
    );
    expect(mocks.updateTicketTags).toHaveBeenCalledWith('ticket-1', { tagIds: ['tag-1', 'tag-2'] });

    await act(async () => finishSave(saved));

    await waitFor(() => expect(queryClient.getQueryData(tagsQueryKey)).toEqual(saved));
  });

  it('keeps the rule attribution of a kept tag and adds a newly picked tag as added by hand', async () => {
    const ruleTag: ITicketTag = {
      ...urgent,
      tag_rule_id: 'rule-1',
      tag_rule_name: 'Failed uploads'
    };
    mocks.updateTicketTags.mockReturnValue(new Promise(() => {}));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ITicketTagsResponse>(tagsQueryKey, { tags: [ruleTag], events: [] });
    const { result } = renderHook(() => useUpdateTicketTagsMutation(), { queryClient });

    act(() =>
      result.current.mutate([
        { tag_id: 'tag-1', name: 'Urgent', color: '#D8292F' },
        { tag_id: 'tag-2', name: 'Blocked', color: '#FCBA19' }
      ])
    );

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketTagsResponse>(tagsQueryKey)?.tags).toEqual([ruleTag, blocked])
    );
  });

  it('restores the previous tags and reports the error when the save fails', async () => {
    mocks.updateTicketTags.mockRejectedValue(new Error('Denied'));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(tagsQueryKey, initial);
    const { result } = renderHook(() => useUpdateTicketTagsMutation(), { queryClient });

    act(() => result.current.mutate([]));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' }));
    expect(queryClient.getQueryData(tagsQueryKey)).toEqual(initial);
  });
});
