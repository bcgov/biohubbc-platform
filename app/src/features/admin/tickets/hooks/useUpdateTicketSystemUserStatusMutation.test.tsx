import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useUpdateTicketSystemUserStatusMutation } from './useUpdateTicketSystemUserStatusMutation';

const mocks = vi.hoisted(() => ({ updateStatus: vi.fn(), setSnackbar: vi.fn() }));
const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-1'];
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tickets: { updateTicketSystemUserStatus: mocks.updateStatus } })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useTicketContext: () => ({ ticketId: 'ticket-1', ticketQueryKey })
}));

const assignee = {
  ticket_system_user_id: 'tsu-1',
  ticket_id: 'ticket-1',
  system_user_id: 7,
  status: 'requested' as const,
  system_user: { system_user_id: 7, display_name: 'Sarah', user_identifier: 'sarah', email: null }
};
const ticket = { ticket_id: 'ticket-1', ticket_system_users: [assignee] } as unknown as ITicketExtended;

/**
 * Reads the cached assignee's status.
 *
 * @param {ReturnType<typeof createTestQueryClient>} queryClient The client holding the ticket.
 * @returns The status shown for the assignee.
 */
const cachedStatus = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.ticket_system_users[0].status;

describe('useUpdateTicketSystemUserStatusMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the status when the change fails', async () => {
    mocks.updateStatus.mockRejectedValue(new Error('Denied'));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const { result } = renderHook(() => useUpdateTicketSystemUserStatusMutation(), { queryClient });

    act(() => result.current.mutate({ ticketSystemUserId: 'tsu-1', status: 'started' }));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' }));
    expect(cachedStatus(queryClient)).toBe('requested');
  });

  it('keeps a later change to the same user when an earlier one fails', async () => {
    let rejectFirst!: (error: Error) => void;
    mocks.updateStatus
      .mockReturnValueOnce(new Promise((_, reject) => (rejectFirst = reject)))
      .mockResolvedValue(assignee);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const { result } = renderHook(() => useUpdateTicketSystemUserStatusMutation(), { queryClient });

    act(() => result.current.mutate({ ticketSystemUserId: 'tsu-1', status: 'started' }));
    await waitFor(() => expect(cachedStatus(queryClient)).toBe('started'));
    act(() => result.current.mutate({ ticketSystemUserId: 'tsu-1', status: 'resolved' }));
    await waitFor(() => expect(cachedStatus(queryClient)).toBe('resolved'));
    await act(async () => rejectFirst(new Error('Denied')));

    await waitFor(() => expect(mocks.setSnackbar).toHaveBeenCalledOnce());
    expect(cachedStatus(queryClient)).toBe('resolved');
  });
});
