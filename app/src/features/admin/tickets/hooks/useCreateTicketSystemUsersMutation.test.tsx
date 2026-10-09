import { QueryObserver } from '@tanstack/react-query';
import { ITicketExtended } from 'interfaces/useTicketsApi.interface';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { useCreateTicketSystemUsersMutation } from './useCreateTicketSystemUsersMutation';

const mocks = vi.hoisted(() => ({ create: vi.fn(), setSnackbar: vi.fn() }));
const ticketQueryKey = ['ticket', 'admin', 'detail', 'ticket-1'];
vi.mock('hooks/useApi', () => ({ useApi: () => ({ tickets: { createTicketSystemUsers: mocks.create } }) }));
vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar }),
  useTicketContext: () => ({ ticketId: 'ticket-1', ticketQueryKey })
}));

const draft = { system_user_id: 7, status: 'requested' as const, display_name: 'Sarah', user_identifier: 'sarah' };
const ticket = { ticket_id: 'ticket-1', ticket_system_users: [] } as unknown as ITicketExtended;

describe('useCreateTicketSystemUsersMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([false, true])(
    'recovers from a read started during creation (read finishes first: %s)',
    async (readFirst) => {
      const created = {
        ticket_system_user_id: 'tsu-1',
        ticket_id: 'ticket-1',
        system_user_id: 7,
        status: 'requested' as const,
        system_user: { system_user_id: 7, display_name: 'Sarah', user_identifier: 'sarah', email: null }
      };
      const saved = { ...ticket, ticket_system_users: [created] };
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(ticketQueryKey, ticket);
      let finishSave!: (value: unknown) => void;
      let finishRead!: (value: unknown) => void;
      mocks.create.mockReturnValue(
        new Promise((resolve) => {
          finishSave = resolve;
        })
      );
      const reload = vi
        .fn()
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishRead = resolve;
          })
        )
        .mockResolvedValue(saved);
      const observer = new QueryObserver(queryClient, {
        queryKey: ticketQueryKey,
        queryFn: reload,
        staleTime: Infinity
      });
      const stop = observer.subscribe(() => undefined);
      const { result } = renderHook(() => useCreateTicketSystemUsersMutation(), { queryClient });
      act(() => result.current.mutate([draft]));
      await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
      const read = observer.refetch();
      if (readFirst) {
        await act(async () => {
          finishRead(ticket);
          await read;
        });
      }
      await act(async () => finishSave([created]));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      if (!readFirst) {
        await act(async () => {
          finishRead(ticket);
          await read;
        });
      }
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.ticket_system_users).toEqual([created]);
      expect(reload).toHaveBeenCalledTimes(2);
      stop();
    }
  );

  it('lists a placeholder, then replaces it with the created row and keeps the user details', async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockReturnValue(new Promise((done) => (resolve = done)));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const { result } = renderHook(() => useCreateTicketSystemUsersMutation(), { queryClient });

    act(() => result.current.mutate([draft]));

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.ticket_system_users).toEqual([
        expect.objectContaining({ ticket_system_user_id: expect.stringMatching(/^optimistic-7-/), system_user_id: 7 })
      ])
    );
    expect(mocks.create).toHaveBeenCalledWith('ticket-1', [{ system_user_id: 7, status: 'requested' }]);
    await act(async () =>
      resolve([
        {
          ticket_system_user_id: 'tsu-1',
          ticket_id: 'ticket-1',
          system_user_id: 7,
          status: 'requested',
          system_user: { system_user_id: 7, display_name: null, user_identifier: '', email: null }
        }
      ])
    );

    await waitFor(() =>
      expect(queryClient.getQueryData<ITicketExtended>(ticketQueryKey)?.ticket_system_users).toEqual([
        expect.objectContaining({
          ticket_system_user_id: 'tsu-1',
          system_user: { system_user_id: 7, display_name: 'Sarah', user_identifier: 'sarah', email: null }
        })
      ])
    );
  });

  it('removes the placeholder when the assignment fails', async () => {
    mocks.create.mockRejectedValue(new Error('Denied'));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(ticketQueryKey, ticket);
    const { result } = renderHook(() => useCreateTicketSystemUsersMutation(), { queryClient });

    act(() => result.current.mutate([draft]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(ticketQueryKey)).toEqual(ticket);
    expect(mocks.setSnackbar).toHaveBeenCalledWith({ open: true, snackbarMessage: 'Denied' });
  });
});
