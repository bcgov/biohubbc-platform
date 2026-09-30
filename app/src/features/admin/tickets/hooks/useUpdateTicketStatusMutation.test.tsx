import { QueryObserver } from '@tanstack/react-query';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useUpdateTicketStatusMutation } from './useUpdateTicketStatusMutation';

const mocks = vi.hoisted(() => ({ updateTicketStatus: vi.fn(), setSnackbar: vi.fn() }));
const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-1'];
vi.mock('hooks/useApi', () => ({ useApi: () => ({ tickets: { updateTicketStatus: mocks.updateTicketStatus } }) }));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useTicketContext: () => ({ ticketId: 'ticket-1', ticketQueryKey })
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

/**
 * Renders the mutation against a client caching the open ticket.
 *
 * @returns The client and the RTL renderHook result.
 */
const renderMutation = () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(ticketQueryKey, ticket);
  return { queryClient, ...renderHook(() => useUpdateTicketStatusMutation(), { queryClient }) };
};

describe('useUpdateTicketStatusMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the new status and its timeline entry, then merges the saved ticket', async () => {
    let resolve!: (value: unknown) => void;
    mocks.updateTicketStatus.mockReturnValue(new Promise((done) => (resolve = done)));
    const { queryClient, result } = renderMutation();

    act(() => result.current.mutate({ status: 'closed', userIdentifier: 'sarah' }));

    await waitFor(() => expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.status).toBe('closed'));
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.statuses).toEqual([
      expect.objectContaining({ status: 'closed', user_identifier: 'sarah' })
    ]);
    await act(async () => resolve({ ...ticket, status: 'closed', subject: 'Saved subject' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)).toMatchObject({
      status: 'closed',
      subject: 'Saved subject',
      statuses: [expect.objectContaining({ status: 'closed' })]
    });
  });

  it('restores the status and removes the timeline entry when the change fails', async () => {
    mocks.updateTicketStatus.mockRejectedValue(new Error('Denied'));
    const { queryClient, result } = renderMutation();

    act(() => result.current.mutate({ status: 'closed', userIdentifier: 'sarah' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(ticketQueryKey)).toEqual(ticket);
    expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' });
  });

  it("drops the ticket's cached lists and portal copy once the change is saved, keeping this page's copy", async () => {
    mocks.updateTicketStatus.mockResolvedValue({ ...ticket, status: 'closed' });
    const { queryClient, result } = renderMutation();
    const adminList = ['ticket', 'admin', 'list', { page: 1 }];
    const portalList = ['ticket', 'user', 'list', { page: 1 }];
    const portalDetail = ['ticket', 'user', 'detail', 'ticket-1'];
    queryClient.setQueryData(adminList, { tickets: [ticket] });
    queryClient.setQueryData(portalList, { tickets: [ticket] });
    queryClient.setQueryData(portalDetail, ticket);

    act(() => result.current.mutate({ status: 'closed', userIdentifier: 'sarah' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect([adminList, portalList, portalDetail].map((key) => queryClient.getQueryData(key))).toEqual([
      undefined,
      undefined,
      undefined
    ]);
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.status).toBe('closed');
  });

  it('reloads the ticket once overlapping changes settle, rather than writing a response that arrives out of order', async () => {
    const responses: Record<string, (value: unknown) => void> = {};
    mocks.updateTicketStatus.mockImplementation(
      (_ticketId: string, status: string) => new Promise((done) => (responses[status] = done))
    );
    let finishReload!: (value: ITicketExtended) => void;
    const reload = vi.fn(() => new Promise<ITicketExtended>((done) => (finishReload = done)));
    const { queryClient, result } = renderMutation();
    const unsubscribe = new QueryObserver(queryClient, {
      queryKey: ticketQueryKey,
      queryFn: reload,
      staleTime: Infinity
    }).subscribe(() => undefined);

    act(() => result.current.mutate({ status: 'closed', userIdentifier: undefined }));
    act(() => result.current.mutate({ status: 'open', userIdentifier: undefined }));
    await waitFor(() => expect(mocks.updateTicketStatus).toHaveBeenCalledTimes(2));

    await act(async () => responses.open({ ...ticket, status: 'open' }));
    await act(async () => responses.closed({ ...ticket, status: 'closed' }));

    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.status).toBe('open');
    await act(async () => finishReload({ ...ticket, status: 'open' }));
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.status).toBe('open');
    unsubscribe();
  });
});
