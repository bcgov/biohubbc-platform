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
});
