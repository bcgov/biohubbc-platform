import { ITicketExtended, ITicketCommentLog } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook } from 'test-helpers/test-utils';
import { useTicketCommentCache } from './useTicketCommentCache';
const key = ['ticket', 'admin', 'detail', 'ticket'];
vi.mock('hooks/useContext', () => ({ useTicketContext: () => ({ ticketId: 'ticket', ticketQueryKey: key }) }));
it('does not append a duplicate comment when a refresh has already loaded the created row', async () => {
  const comment: ITicketCommentLog = {
    ticket_comment_id: 'comment',
    ticket_id: 'ticket',
    user_identifier: 'Sarah',
    create_date: '2026-03-01T00:00:00Z',
    comment: 'Saved comment',
    artifacts: []
  };
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(key, { comments: [comment] });
  const { result } = renderHook(() => useTicketCommentCache(), { queryClient });
  await act(async () => {
    await result.current.appendCachedComment(comment);
  });
  expect(queryClient.getQueryData<ITicketExtended>(key)?.comments).toEqual([comment]);
});
