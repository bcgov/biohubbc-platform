import { QueryObserver } from '@tanstack/react-query';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useUpdateTicketMutation } from './useUpdateTicketMutation';
import { useUpdateTicketStatusMutation } from './useUpdateTicketStatusMutation';

const mocks = vi.hoisted(() => ({ edit: vi.fn(), status: vi.fn(), snackbar: vi.fn(), ticketId: 'ticket-1' }));
const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-1'];
vi.mock('hooks/useApi', () => ({
  useApi: () => ({ tickets: { updateTicket: mocks.edit, updateTicketStatus: mocks.status } })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.snackbar }),
  useTicketContext: () => ({ ticketId: mocks.ticketId, ticketQueryKey: ['ticket', 'admin', 'detail', mocks.ticketId] })
}));

const ticket: ITicketExtended = {
  ticket_id: 'ticket-1',
  ticket_slug: '04900001',
  subject: 'Subject',
  description: null,
  team_id: 'team-1',
  create_date: '2026-03-01T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references: [],
  ticket_system_users: [],
  data_requests: [],
  submission_uploads: []
};

describe('useUpdateTicketMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketId = 'ticket-1';
  });

  it('refreshes saved details after a concurrent optimistic status change settles', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const saved = { ...ticket, subject: 'Saved subject', status: 'closed' as const };
    const read = vi.fn().mockResolvedValue(saved);
    const unsubscribe = new QueryObserver(queryClient, {
      queryKey: ticketQueryKey,
      queryFn: read,
      staleTime: Infinity
    }).subscribe(() => undefined);
    let finishStatus!: (value: ITicketExtended) => void;
    mocks.status.mockReturnValue(
      new Promise((resolve) => {
        finishStatus = resolve;
      })
    );
    mocks.edit.mockResolvedValue({ ...ticket, subject: 'Saved subject' });
    const { result } = renderHook(
      () => ({ edit: useUpdateTicketMutation(), status: useUpdateTicketStatusMutation() }),
      { queryClient }
    );

    act(() => result.current.status.mutate({ status: 'closed', userIdentifier: undefined }));
    await waitFor(() => expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.status).toBe('closed'));
    await act(async () => {
      await result.current.edit.mutateAsync({ subject: 'Saved subject' });
    });
    expect(read).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)).toMatchObject({
      subject: 'Subject',
      status: 'closed'
    });
    await act(async () => finishStatus({ ...ticket, status: 'closed' }));
    await waitFor(() => expect(queryClient.getQueryData(ticketQueryKey)).toEqual(saved));
    expect(read).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshes the original ticket when navigation occurs during a save', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const otherKey = ['ticket', 'admin', 'detail', 'ticket-2'];
    const otherTicket = { ...ticket, ticket_id: 'ticket-2' };
    queryClient.setQueryData(otherKey, otherTicket);
    let finishEdit!: (value: ITicketExtended) => void;
    mocks.edit.mockReturnValue(
      new Promise((resolve) => {
        finishEdit = resolve;
      })
    );
    const { result, rerender } = renderHook(() => useUpdateTicketMutation(), { queryClient });
    act(() => result.current.mutate({ subject: 'Saved subject' }));
    await waitFor(() => expect(mocks.edit).toHaveBeenCalled());
    mocks.ticketId = 'ticket-2';
    rerender();
    await act(async () => finishEdit({ ...ticket, subject: 'Saved subject' }));
    await waitFor(() => expect(queryClient.getQueryData(ticketQueryKey)).toBeUndefined());
    expect(queryClient.getQueryData(otherKey)).toEqual(otherTicket);
  });

  it('leaves cached details unchanged and reports a failed edit', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    mocks.edit.mockRejectedValue(new Error('Denied'));
    const { result } = renderHook(() => useUpdateTicketMutation(), { queryClient });
    act(() => result.current.mutate({ subject: 'Unsaved subject' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(ticketQueryKey)).toEqual(ticket);
    expect(mocks.snackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' });
  });
});
