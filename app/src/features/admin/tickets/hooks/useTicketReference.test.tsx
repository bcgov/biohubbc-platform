import { CreateTicketReferenceDialog } from '../components/dialog/reference/CreateTicketReferenceDialog';
import { ICreateTicketReferenceFormValues } from '../components/dialog/reference/form/TicketReferenceForm';
import { ticketQueryKeys } from 'utils/query-keys/ticket-query-keys';
import { QueryClient } from '@tanstack/react-query';
import { ITicketExtended, ITicketReference } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, render, renderHook, waitFor } from 'test-helpers/test-utils';
import { useTicketReference } from './useTicketReference';

const mocks = vi.hoisted(() => ({
  ticketId: 'ticket-a',
  createTicketReference: vi.fn(),
  deleteTicketReference: vi.fn(),
  setSnackbar: vi.fn(),
  dialog: vi.fn()
}));
const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-a'];
vi.mock('hooks/useApi', () => ({
  useApi: () => ({
    tickets: { createTicketReference: mocks.createTicketReference, deleteTicketReference: mocks.deleteTicketReference }
  })
}));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useTicketContext: () => ({
    ticketId: mocks.ticketId,
    ticketQueryKey: ticketQueryKeys.detail('admin', mocks.ticketId)
  })
}));

vi.mock('components/dialog/EditDialog', () => ({
  EditDialog: (props: { onSave: (values: ICreateTicketReferenceFormValues) => void }) => {
    mocks.dialog(props);
    return null;
  }
}));

/**
 * Wires the reference dialog to its real cache writer while route context changes.
 *
 * @returns The dialog with its submission callback.
 */
const ReferenceDialog = () => {
  const references = useTicketReference();
  return (
    <CreateTicketReferenceDialog
      open={false}
      onClose={references.closeCreateReferenceDialog}
      onSubmit={references.handleCreateReferenceSubmit}
    />
  );
};

const reference: ITicketReference = {
  ticket_reference_id: 'reference-1',
  source_ticket_id: 'ticket-a',
  source_ticket_slug: '04900001',
  source_ticket_subject: 'Ticket A',
  target_ticket_id: 'ticket-b',
  target_ticket_slug: '04900002',
  target_ticket_subject: 'Ticket B',
  relationship: 'relates_to',
  user_identifier: 'sarah',
  create_date: '2026-03-01T00:00:00.000Z'
};

const ticket = (references: ITicketReference[]): ITicketExtended => ({
  ticket_id: 'ticket-a',
  ticket_slug: '04900001',
  subject: 'Ticket A',
  description: null,
  team_id: 'team-1',
  create_date: '2026-03-01T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  statuses: [],
  comments: [],
  references,
  ticket_system_users: [],
  data_requests: [],
  submission_uploads: []
});

const linkedTicketCopies = [
  ['ticket', 'admin', 'detail', 'ticket-b'],
  ['ticket', 'user', 'detail', 'ticket-b']
];

/**
 * Renders the hook against a client caching ticket A with the given references, and ticket B's detail copies.
 *
 * @param {ITicketReference[]} references Ticket A's references.
 * @returns {{ queryClient: QueryClient }} The client, with the RTL renderHook result.
 */
const renderReferences = (references: ITicketReference[]) => {
  const queryClient: QueryClient = createTestQueryClient();
  queryClient.setQueryData(ticketQueryKey, ticket(references));
  linkedTicketCopies.forEach((key) => queryClient.setQueryData(key, { cached: true }));
  return { queryClient, ...renderHook(() => useTicketReference(), { queryClient }) };
};

describe('useTicketReference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketId = 'ticket-a';
  });

  it('keeps a created reference on the original ticket after navigating elsewhere', async () => {
    const queryClient = createTestQueryClient();
    const otherKey = ticketQueryKeys.detail('admin', 'unrelated-ticket');
    queryClient.setQueryData(ticketQueryKey, ticket([]));
    queryClient.setQueryData(otherKey, { ...ticket([]), ticket_id: 'unrelated-ticket' });
    let finish!: (references: ITicketReference[]) => void;
    mocks.createTicketReference.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { rerender } = render(<ReferenceDialog />, { queryClient });
    const { onSave } = mocks.dialog.mock.lastCall![0];
    act(() => onSave({ source_ticket_id: 'ticket-a', target_ticket_ids: ['ticket-b'], relationship: 'relates_to' }));
    await waitFor(() => expect(mocks.createTicketReference).toHaveBeenCalled());

    mocks.ticketId = 'unrelated-ticket';
    rerender(<ReferenceDialog />);
    await act(async () => finish([reference]));

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references).toEqual([reference])
    );
    expect(queryClient.getQueryData<ITicketExtended>(otherKey)?.references).toEqual([]);
  });

  it('does not duplicate a created reference already loaded by a refresh', async () => {
    const { queryClient, result } = renderReferences([reference]);
    await act(async () => {
      await result.current.handleCreateReferenceSubmit([reference]);
    });
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references).toEqual([reference]);
  });

  it("adds a created reference and drops the linked ticket's cached copies, which list it too", async () => {
    const { queryClient, result } = renderReferences([]);

    await act(async () => {
      await result.current.handleCreateReferenceSubmit([reference]);
    });

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references).toEqual([reference])
    );
    expect(linkedTicketCopies.map((key) => queryClient.getQueryData(key))).toEqual([undefined, undefined]);
  });

  it("removes a deleted reference and drops the linked ticket's cached copies", async () => {
    mocks.deleteTicketReference.mockResolvedValue(undefined);
    const { queryClient, result } = renderReferences([reference]);

    act(() => result.current.handleDeleteReference('reference-1'));

    await waitFor(() => expect(mocks.deleteTicketReference).toHaveBeenCalledWith('ticket-a', 'reference-1'));
    await waitFor(() =>
      expect(linkedTicketCopies.map((key) => queryClient.getQueryData(key))).toEqual([undefined, undefined])
    );
    expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references).toEqual([]);
  });

  it('keeps the cached ticket lists, which show none of the fields a reference changes', async () => {
    const { queryClient, result } = renderReferences([]);
    const adminList = ['ticket', 'admin', 'list', { page: 1 }];
    queryClient.setQueryData(adminList, { tickets: [] });

    await act(async () => {
      await result.current.handleCreateReferenceSubmit([reference]);
    });

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.references).toEqual([reference])
    );
    expect(queryClient.getQueryData(adminList)).toEqual({ tickets: [] });
  });
});
